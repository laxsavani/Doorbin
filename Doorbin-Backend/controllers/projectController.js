const Project = require('../models/Project');
const Stage = require('../models/Stage');
const Client = require('../models/Client');
const User = require('../models/User');
const WorkflowTemplate = require('../models/WorkflowTemplate');
const logActivity = require('../utils/activityLogger');
const mongoose = require('mongoose');

// Helper to check if user is Director
const isDirectorUser = (req) => {
  return req.user?.role?.name === 'Director' || req.user?.role?.permissions?.userManagement === true;
};

// Helper to calculate project progress & auto-evaluate delay status
const recalculateProjectProgress = async (projectId) => {
  const project = await Project.findById(projectId);
  if (!project) return;

  const stages = await Stage.find({ project: projectId }).sort({ order: 1 });
  if (stages.length === 0) return;

  let totalStageProgress = 0;
  for (const st of stages) {
    totalStageProgress += (st.completionPercentage || 0);
  }

  const avgProgress = Number((totalStageProgress / stages.length).toFixed(2));
  project.progressPercentage = avgProgress;

  // Auto status calculation
  if (project.status !== 'On Hold') {
    const now = new Date();
    if (avgProgress === 100) {
      project.status = 'Completed';
    } else if (now > project.endDate && avgProgress < 100) {
      project.status = 'Delayed';
    } else if (avgProgress > 0) {
      project.status = 'In Progress';
    } else {
      project.status = 'Not Started';
    }
  }

  await project.save();
  return { progressPercentage: project.progressPercentage, status: project.status };
};

// @desc    Create a new project & clone WorkflowTemplate stages
// @route   POST /api/projects
// @access  Private (PM / Director - projectManagement)
const createProject = async (req, res) => {
  const {
    projectName,
    client,
    originEnquiry,
    projectCategory,
    projectSubType,
    priority,
    budget,
    startDate,
    endDate,
    billingParty,
    productionManager,
    assignedTeam
  } = req.body;

  if (!projectName || !projectName.trim()) {
    return res.status(400).json({ message: 'Project name is required' });
  }
  if (!client || !mongoose.Types.ObjectId.isValid(client)) {
    return res.status(400).json({ message: 'Valid client ID is required' });
  }
  if (!projectCategory || !['Architecture', 'Interior Design', 'Animation'].includes(projectCategory)) {
    return res.status(400).json({ message: 'Valid projectCategory (Architecture, Interior Design, Animation) is required' });
  }
  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'startDate and endDate are required' });
  }
  if (!productionManager || !mongoose.Types.ObjectId.isValid(productionManager)) {
    return res.status(400).json({ message: 'Valid productionManager user ID is required' });
  }

  try {
    const clientObj = await Client.findById(client);
    if (!clientObj || clientObj.status === 'Inactive') {
      return res.status(400).json({ message: 'Client not found or client is inactive' });
    }

    const pmUser = await User.findById(productionManager);
    if (!pmUser) {
      return res.status(400).json({ message: 'Production Manager user not found' });
    }

    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const calcDays = Math.max(1, Math.ceil(Math.abs(endMs - startMs) / (1000 * 3600 * 24)) + 1);
    const computedTotalDays = req.body.totalDays ? Number(req.body.totalDays) : calcDays;

    const project = await Project.create({
      projectName: projectName.trim(),
      client,
      originEnquiry: originEnquiry && mongoose.Types.ObjectId.isValid(originEnquiry) ? originEnquiry : null,
      projectCategory,
      projectSubType: projectSubType ? projectSubType.trim() : undefined,
      priority: priority || 'Medium',
      budget: budget ? Number(budget) : undefined,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalDays: computedTotalDays,
      totalWorkingDays: computedTotalDays,
      billingParty: billingParty ? billingParty.trim() : undefined,
      productionManager,
      assignedTeam: Array.isArray(assignedTeam) ? assignedTeam : [],
      status: 'Not Started',
      progressPercentage: 0,
      isDeleted: false,
      createdBy: req.user._id
    });

    // Fetch template or fallback to standard Doorbin category templates (Section 6.5)
    let template = await WorkflowTemplate.findOne({
      projectCategory: new RegExp(`^${projectCategory}$`, 'i')
    });

    let stagesToClone = template && Array.isArray(template.stages) ? template.stages : null;

    if (!stagesToClone) {
      if (/architecture/i.test(projectCategory)) {
        stagesToClone = [
          { name: 'Scene Preparation', order: 1, subStages: [{ name: 'Building' }, { name: 'Site Development' }, { name: 'Vegetation & Landscape' }, { name: 'Context Development' }] },
          { name: 'Sketch Development', order: 2, subStages: [{ name: 'Sketch 01 Composition' }, { name: 'Mood & Lighting' }, { name: 'Post Production' }] },
          { name: 'Final Rendering', order: 3, subStages: [{ name: 'Client Feedback' }, { name: 'Post Production' }] }
        ];
      } else if (/interior/i.test(projectCategory)) {
        stagesToClone = [
          { name: 'First Draft', order: 1, subStages: [{ name: 'Modeling' }, { name: 'Texturing' }, { name: 'Lighting & Rendering' }, { name: 'Post Production' }] },
          { name: 'Revision Cycle', order: 2, subStages: [{ name: 'Revision 1' }, { name: 'Revision 2' }, { name: 'Final Approval' }] }
        ];
      } else if (/animation/i.test(projectCategory)) {
        stagesToClone = [
          { name: 'Pre-Production', order: 1, subStages: [{ name: 'Story & Script' }, { name: 'Storyboard' }, { name: 'Moodboard' }] },
          { name: 'Shot Composition', order: 2, subStages: [{ name: 'Camera Animation' }, { name: 'Scene Animation' }, { name: 'Rendering' }, { name: 'Post Production' }] }
        ];
      }
    }

    if (stagesToClone && stagesToClone.length > 0) {
      const createdStages = [];
      const stageIdMap = {};

      for (let i = 0; i < stagesToClone.length; i++) {
        const tplStage = stagesToClone[i];
        const subStagesToInsert = (tplStage.subStages || []).map((sub, sIdx) => ({
          name: typeof sub === 'string' ? sub : sub.name,
          order: sub.order || (sIdx + 1),
          status: 'Pending',
          completionPercentage: 0,
          dependencies: []
        }));

        const newStage = await Stage.create({
          project: project._id,
          stageName: tplStage.name,
          order: tplStage.order || (i + 1),
          approvalRequired: tplStage.approvalRequired || false,
          dependsOn: [],
          subStages: subStagesToInsert,
          status: 'Not Started',
          completionPercentage: 0
        });

        createdStages.push(newStage);
        stageIdMap[i] = newStage._id;
      }

      for (let i = 1; i < createdStages.length; i++) {
        const currentStage = createdStages[i];
        const prevStageId = stageIdMap[i - 1];
        if (prevStageId) {
          currentStage.dependsOn = [prevStageId];
          await currentStage.save();
        }
      }
    }

    await logActivity({
      req,
      userId: req.user._id,
      action: 'PROJECT_CREATED',
      targetType: 'Project',
      targetId: project._id,
      metadata: { projectName: project.projectName, category: project.projectCategory }
    });

    const populatedProject = await Project.findById(project._id)
      .populate('client', 'companyName clientName email')
      .populate('productionManager', 'name email role')
      .populate('assignedTeam', 'name email role');

    return res.status(201).json(populatedProject);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get list of projects (Department-Scoped Visibility)
// @route   GET /api/projects
// @access  Private (Authenticated users)
const getProjects = async (req, res) => {
  try {
    const { status, projectCategory, client, page = 1, limit = 20, search } = req.query;
    const query = { isDeleted: { $ne: true } };

    if (status) query.status = status;
    if (projectCategory) query.projectCategory = projectCategory;
    if (client) query.client = client;

    if (search && search.trim()) {
      query.$text = { $search: search.trim() };
    }

    // User Assignment Scoped Visibility Rule
    if (!isDirectorUser(req)) {
      const isPM = req.user?.role?.name === 'Production Manager' || req.user?.role?.permissions?.projectManagement === true;
      if (isPM) {
        query.$or = [
          { productionManager: req.user._id },
          { assignedTeam: req.user._id }
        ];
      } else {
        // Artist / Team Member: STRICT USER DATA ISOLATION (Only projects assigned to req.user._id)
        query.$or = [
          { assignedTeam: req.user._id },
          { productionManager: req.user._id }
        ];
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const projects = await Project.find(query)
      .populate('client', 'companyName clientName')
      .populate('productionManager', 'name email department')
      .populate('assignedTeam', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // On-read delay status recalculation
    const now = new Date();
    for (const p of projects) {
      if (p.status !== 'On Hold' && p.status !== 'Completed') {
        if (now > p.endDate && p.progressPercentage < 100 && p.status !== 'Delayed') {
          p.status = 'Delayed';
          await p.save();
        }
      }
    }

    const total = await Project.countDocuments(query);

    return res.json({
      projects,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get single project details with populated stages
// @route   GET /api/projects/:id
// @access  Private (Authenticated users - visibility checked)
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
      .populate('client', 'companyName clientName email phone address')
      .populate('productionManager', 'name email phone role department')
      .populate('assignedTeam', 'name email phone role')
      .populate('createdBy', 'name email');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Visibility Check for non-Director
    if (!isDirectorUser(req)) {
      const pmUser = await User.findById(project.productionManager._id);
      const sameDepartment = req.user.department && pmUser?.department &&
        req.user.department.toString() === pmUser.department.toString();

      const isPM = project.productionManager._id.toString() === req.user._id.toString();
      const isTeam = project.assignedTeam.some(t => t._id.toString() === req.user._id.toString());

      if (!isPM && !isTeam && !sameDepartment) {
        return res.status(403).json({ message: 'Access denied. You do not have permission to view this project.' });
      }
    }

    const stages = await Stage.find({ project: project._id })
      .populate('dependsOn', 'stageName status')
      .populate('approvedBy', 'name email')
      .sort({ order: 1 });

    return res.json({ project, stages });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update project details
// @route   PUT /api/projects/:id
// @access  Private (PM / Director - projectManagement)
const updateProject = async (req, res) => {
  const {
    projectName,
    projectCategory,
    projectSubType,
    priority,
    budget,
    startDate,
    endDate,
    billingParty,
    productionManager,
    assignedTeam,
    status
  } = req.body;

  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (projectName !== undefined) project.projectName = projectName.trim();
    if (projectCategory && ['Architecture', 'Interior Design', 'Animation'].includes(projectCategory)) {
      project.projectCategory = projectCategory;
    }
    if (projectSubType !== undefined) project.projectSubType = projectSubType.trim();
    if (priority && ['High', 'Medium', 'Low'].includes(priority)) project.priority = priority;
    if (budget !== undefined) project.budget = Number(budget);
    if (startDate !== undefined) project.startDate = new Date(startDate);
    if (endDate !== undefined) project.endDate = new Date(endDate);

    if (project.startDate && project.endDate) {
      const startMs = new Date(project.startDate).getTime();
      const endMs = new Date(project.endDate).getTime();
      const calcDays = Math.max(1, Math.ceil(Math.abs(endMs - startMs) / (1000 * 3600 * 24)) + 1);
      project.totalDays = req.body.totalDays ? Number(req.body.totalDays) : calcDays;
      project.totalWorkingDays = project.totalDays;
    }
    if (billingParty !== undefined) project.billingParty = billingParty.trim();

    if (productionManager && mongoose.Types.ObjectId.isValid(productionManager)) {
      const pmUser = await User.findById(productionManager);
      if (pmUser) project.productionManager = productionManager;
    }

    if (Array.isArray(assignedTeam)) {
      project.assignedTeam = assignedTeam;
    }

    if (status && ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Delayed'].includes(status)) {
      project.status = status;
    }

    await project.save();
    await recalculateProjectProgress(project._id);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'PROJECT_UPDATED',
      targetType: 'Project',
      targetId: project._id,
      metadata: { projectName: project.projectName }
    });

    const updatedProject = await Project.findById(project._id)
      .populate('client', 'companyName clientName')
      .populate('productionManager', 'name email')
      .populate('assignedTeam', 'name email');

    return res.json(updatedProject);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Soft-delete project (Director ONLY)
// @route   DELETE /api/projects/:id
// @access  Private (Director ONLY - deleteProjects)
const deleteProject = async (req, res) => {
  try {
    const isDirector = isDirectorUser(req);
    if (!isDirector) {
      return res.status(403).json({ message: 'Access denied: Deleting a project requires explicit Director privileges.' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    project.isDeleted = true;
    await project.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'PROJECT_DELETED',
      targetType: 'Project',
      targetId: project._id,
      metadata: { projectName: project.projectName }
    });

    return res.json({ message: `Project '${project.projectName}' soft-deleted successfully.` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Add custom stage to project instance (beyond template)
// @route   POST /api/projects/:id/stages
// @access  Private (PM / Director - projectManagement)
const addProjectStage = async (req, res) => {
  const { stageName, order, approvalRequired, dependsOn, subStages } = req.body;

  if (!stageName || !stageName.trim()) {
    return res.status(400).json({ message: 'Stage name is required' });
  }

  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const existingStages = await Stage.find({ project: project._id });
    const stageOrder = order || (existingStages.length + 1);

    const subStagesToInsert = (Array.isArray(subStages) ? subStages : []).map((sub, idx) => ({
      name: sub.name,
      groupLabel: sub.groupLabel,
      order: sub.order || (idx + 1),
      status: 'Pending',
      completionPercentage: 0,
      dependencies: []
    }));

    const stage = await Stage.create({
      project: project._id,
      stageName: stageName.trim(),
      order: stageOrder,
      approvalRequired: approvalRequired || false,
      dependsOn: Array.isArray(dependsOn) ? dependsOn : [],
      subStages: subStagesToInsert,
      status: 'Not Started',
      completionPercentage: 0
    });

    await recalculateProjectProgress(project._id);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'PROJECT_STAGE_ADDED',
      targetType: 'Project',
      targetId: project._id,
      metadata: { stageName: stage.stageName }
    });

    return res.status(201).json(stage);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update project stage details
// @route   PUT /api/projects/:id/stages/:stageId
// @access  Private (PM / Director - projectManagement)
const updateProjectStage = async (req, res) => {
  const { stageName, order, dependsOn, approvalRequired } = req.body;

  try {
    const stage = await Stage.findOne({ _id: req.params.stageId, project: req.params.id });
    if (!stage) {
      return res.status(404).json({ message: 'Stage not found' });
    }

    if (stageName !== undefined) stage.stageName = stageName.trim();
    if (order !== undefined) stage.order = Number(order);
    if (Array.isArray(dependsOn)) stage.dependsOn = dependsOn;
    if (approvalRequired !== undefined) stage.approvalRequired = Boolean(approvalRequired);

    await stage.save();
    await recalculateProjectProgress(req.params.id);

    return res.json(stage);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update sub-stage status (Cascading Progress & Dependency Check)
// @route   PUT /api/projects/:id/stages/:stageId/substages/:subStageId
// @access  Private (Artist / PM / Director - taskManagement or projectManagement)
const updateSubStageStatus = async (req, res) => {
  const { status, completionPercentage } = req.body;

  if (!status || !['Pending', 'In Progress', 'Under Review', 'Completed', 'Approved'].includes(status)) {
    return res.status(400).json({ message: 'Valid status (Pending, In Progress, Under Review, Completed, Approved) is required' });
  }

  try {
    const stage = await Stage.findOne({ _id: req.params.stageId, project: req.params.id });
    if (!stage) {
      return res.status(404).json({ message: 'Stage not found' });
    }

    // Stage Dependency Check
    if (['In Progress', 'Under Review', 'Completed', 'Approved'].includes(status)) {
      if (stage.dependsOn && stage.dependsOn.length > 0) {
        const prereqStages = await Stage.find({ _id: { $in: stage.dependsOn } });
        for (const pre of prereqStages) {
          if (pre.status !== 'Completed') {
            return res.status(400).json({
              message: `Prerequisite stage '${pre.stageName}' must be completed before starting '${stage.stageName}'.`
            });
          }
        }
      }
    }

    const subStage = stage.subStages.id(req.params.subStageId);
    if (!subStage) {
      return res.status(404).json({ message: 'Sub-stage not found' });
    }

    subStage.status = status;
    if (['Completed', 'Approved'].includes(status)) {
      subStage.completionPercentage = 100;
    } else if (completionPercentage !== undefined) {
      subStage.completionPercentage = Number(completionPercentage);
    } else if (status === 'Pending') {
      subStage.completionPercentage = 0;
    }

    // Calculate Stage completionPercentage
    if (stage.subStages.length > 0) {
      let totalSubProgress = 0;
      for (const sub of stage.subStages) {
        totalSubProgress += (sub.completionPercentage || 0);
      }
      stage.completionPercentage = Number((totalSubProgress / stage.subStages.length).toFixed(2));
    }

    // Auto stage status logic
    const allSubCompleted = stage.subStages.every(s => ['Completed', 'Approved'].includes(s.status));
    if (allSubCompleted && !stage.approvalRequired) {
      stage.status = 'Completed';
    } else if (stage.completionPercentage > 0) {
      stage.status = 'In Progress';
    } else {
      stage.status = 'Not Started';
    }

    await stage.save();
    const updatedProgress = await recalculateProjectProgress(req.params.id);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'SUBSTAGE_STATUS_UPDATED',
      targetType: 'Stage',
      targetId: stage._id,
      metadata: { subStageName: subStage.name, newStatus: status }
    });

    return res.json({
      stage,
      projectProgress: updatedProgress
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Approve Stage Checkpoint (approvalRequired)
// @route   POST /api/projects/:id/stages/:stageId/approve
// @access  Private (PM / Director - projectManagement)
const approveStage = async (req, res) => {
  try {
    const stage = await Stage.findOne({ _id: req.params.stageId, project: req.params.id });
    if (!stage) {
      return res.status(404).json({ message: 'Stage not found' });
    }

    if (!stage.approvalRequired) {
      return res.status(400).json({ message: `Stage '${stage.stageName}' does not require formal approval.` });
    }

    stage.status = 'Completed';
    stage.completionPercentage = 100;
    stage.approvedBy = req.user._id;
    stage.approvedAt = new Date();

    await stage.save();
    const updatedProgress = await recalculateProjectProgress(req.params.id);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'STAGE_APPROVED',
      targetType: 'Stage',
      targetId: stage._id,
      metadata: { stageName: stage.stageName }
    });

    return res.json({
      message: `Stage '${stage.stageName}' approved successfully by ${req.user.name}.`,
      stage,
      projectProgress: updatedProgress
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get project computed progress & stage breakdown
// @route   GET /api/projects/:id/progress
// @access  Private (Authenticated users - visibility checked)
const getProjectProgress = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const stages = await Stage.find({ project: project._id }).sort({ order: 1 });
    const progressData = await recalculateProjectProgress(project._id);

    return res.json({
      projectId: project._id,
      projectName: project.projectName,
      overallProgressPercentage: progressData.progressPercentage,
      status: progressData.status,
      stages: stages.map(s => ({
        stageId: s._id,
        stageName: s.stageName,
        order: s.order,
        status: s.status,
        completionPercentage: s.completionPercentage,
        approvalRequired: s.approvalRequired,
        approvedAt: s.approvedAt
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all delayed projects
// @route   GET /api/projects/delayed
// @access  Private (PM / Director)
const getDelayedProjects = async (req, res) => {
  try {
    const now = new Date();
    const query = {
      isDeleted: { $ne: true },
      $or: [
        { status: 'Delayed' },
        { endDate: { $lt: now }, progressPercentage: { $lt: 100 }, status: { $ne: 'Completed' } }
      ]
    };

    const delayedProjects = await Project.find(query)
      .populate('client', 'companyName clientName')
      .populate('productionManager', 'name email')
      .sort({ endDate: 1 });

    return res.json({
      count: delayedProjects.length,
      delayedProjects
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Project Report 1: Active Projects
// @route   GET /api/projects/reports/active
// @access  Private (PM / Director)
const getActiveProjectsReport = async (req, res) => {
  try {
    const activeProjects = await Project.find({
      isDeleted: { $ne: true },
      status: { $in: ['Not Started', 'In Progress', 'Delayed'] }
    })
      .populate('client', 'companyName clientName')
      .populate('productionManager', 'name email')
      .sort({ createdAt: -1 });

    return res.json({ count: activeProjects.length, projects: activeProjects });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Project Report 2: Completed Projects
// @route   GET /api/projects/reports/completed
// @access  Private (PM / Director)
const getCompletedProjectsReport = async (req, res) => {
  try {
    const completedProjects = await Project.find({
      isDeleted: { $ne: true },
      status: 'Completed'
    })
      .populate('client', 'companyName clientName')
      .populate('productionManager', 'name email')
      .sort({ updatedAt: -1 });

    return res.json({ count: completedProjects.length, projects: completedProjects });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Project Report 3: Stage-wise Progress Report
// @route   GET /api/projects/reports/stage-wise-progress
// @access  Private (PM / Director)
const getStageProgressReport = async (req, res) => {
  try {
    const activeProjects = await Project.find({ isDeleted: { $ne: true }, status: { $ne: 'Completed' } });
    const reportData = [];

    for (const proj of activeProjects) {
      const stages = await Stage.find({ project: proj._id }).sort({ order: 1 });
      reportData.push({
        projectId: proj._id,
        projectName: proj.projectName,
        projectCategory: proj.projectCategory,
        overallProgress: proj.progressPercentage,
        stages: stages.map(s => ({ stageName: s.stageName, status: s.status, progress: s.completionPercentage }))
      });
    }

    return res.json({ totalActiveProjects: activeProjects.length, reportData });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Project Report 4: Client-wise Projects Report
// @route   GET /api/projects/reports/client-wise
// @access  Private (PM / Director)
const getClientProjectsReport = async (req, res) => {
  try {
    const clients = await Client.find({ status: 'Active' });
    const reportData = [];

    for (const c of clients) {
      const projects = await Project.find({ client: c._id, isDeleted: { $ne: true } });
      if (projects.length > 0) {
        reportData.push({
          client: { _id: c._id, companyName: c.companyName, clientName: c.clientName },
          totalProjects: projects.length,
          projects: projects.map(p => ({ projectId: p._id, projectName: p.projectName, status: p.status, progress: p.progressPercentage }))
        });
      }
    }

    return res.json(reportData);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a custom stage from a project
// @route   DELETE /api/projects/:id/stages/:stageId
// @access  Private (PM / Director - projectManagement)
const deleteCustomStage = async (req, res) => {
  const { id, stageId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(stageId)) {
    return res.status(400).json({ message: 'Invalid project or stage ID' });
  }

  try {
    const project = await Project.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or deleted' });
    }

    const stage = await Stage.findOne({ _id: stageId, project: id });
    if (!stage) {
      return res.status(404).json({ message: 'Stage not found in this project' });
    }

    // Safety rail: Block deletion if stage has tasks assigned to it
    const Task = require('../models/Task');
    const tasksCount = await Task.countDocuments({ stage: stageId });
    if (tasksCount > 0) {
      return res.status(400).json({ message: `Cannot delete stage '${stage.stageName}' because ${tasksCount} task(s) are assigned to it.` });
    }

    await Stage.findByIdAndDelete(stageId);
    await recalculateProjectProgress(id);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'STAGE_DELETED',
      targetType: 'Stage',
      targetId: stageId,
      metadata: { stageName: stage.stageName, project: id }
    });

    return res.json({ message: `Stage '${stage.stageName}' deleted successfully` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Add attachment URL to project
// @route   POST /api/projects/:id/attachments
// @access  Private (Authenticated Users)
const addProjectAttachment = async (req, res) => {
  const { fileUrl } = req.body;
  if (!fileUrl) return res.status(400).json({ message: 'fileUrl is required' });

  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    project.attachments.push(fileUrl);
    await project.save();

    return res.json(project.attachments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get project attachments
// @route   GET /api/projects/:id/attachments
// @access  Private (Authenticated Users)
const getProjectAttachments = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    return res.json(project.attachments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Add comment to project
// @route   POST /api/projects/:id/comments
// @access  Private (Authenticated Users)
const addProjectComment = async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: 'Comment text is required' });

  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    project.comments.push({
      user: req.user._id,
      text: text.trim(),
      date: new Date()
    });

    await project.save();
    const updated = await Project.findById(project._id).populate('comments.user', 'name email');

    return res.status(201).json(updated.comments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get project comments
// @route   GET /api/projects/:id/comments
// @access  Private (Authenticated Users)
const getProjectComments = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
      .populate('comments.user', 'name email');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    return res.json(project.comments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get assigned team for project
// @route   GET /api/projects/:id/team
// @access  Private (Authenticated Users)
const getProjectTeam = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
      .populate('productionManager', 'name email phone role')
      .populate('assignedTeam', 'name email phone role department');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    return res.json({
      productionManager: project.productionManager,
      assignedTeam: project.assignedTeam
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Assign team members to project
// @route   POST /api/projects/:id/team
// @access  Private (PM / Director)
const updateProjectTeam = async (req, res) => {
  const { assignedTeam, productionManager } = req.body;

  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (Array.isArray(assignedTeam)) {
      project.assignedTeam = assignedTeam;
    }
    if (productionManager) {
      project.productionManager = productionManager;
    }

    await project.save();
    const updated = await Project.findById(project._id)
      .populate('productionManager', 'name email')
      .populate('assignedTeam', 'name email role department');

    return res.json({
      productionManager: updated.productionManager,
      assignedTeam: updated.assignedTeam
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Approve a pending project (Director only)
// @route   PATCH /api/projects/:id/approve
// @access  Private (Director)
const approveProject = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    project.status = 'Approved';
    project.approvedBy = req.user._id;
    project.approvalDate = new Date();
    await project.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'PROJECT_APPROVED',
      targetType: 'Project',
      targetId: project._id,
      metadata: { projectName: project.projectName }
    });

    return res.json({
      success: true,
      message: 'Project approved successfully',
      project
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Reject a pending project (Director only)
// @route   PATCH /api/projects/:id/reject
// @access  Private (Director)
const rejectProject = async (req, res) => {
  try {
    const { reason } = req.body;
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    project.status = 'Rejected';
    project.approvedBy = req.user._id;
    project.approvalDate = new Date();
    if (reason) {
      project.comments.push({ user: req.user._id, text: `Rejection reason: ${reason}` });
    }
    await project.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'PROJECT_REJECTED',
      targetType: 'Project',
      targetId: project._id,
      metadata: { projectName: project.projectName, reason }
    });

    return res.json({
      success: true,
      message: 'Project rejected',
      project
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  approveProject,
  rejectProject,
  addProjectStage,
  updateProjectStage,
  deleteCustomStage,
  updateSubStageStatus,
  approveStage,
  getProjectProgress,
  getDelayedProjects,
  getActiveProjectsReport,
  getCompletedProjectsReport,
  getStageProgressReport,
  getClientProjectsReport,
  recalculateProjectProgress,
  addProjectAttachment,
  getProjectAttachments,
  addProjectComment,
  getProjectComments,
  getProjectTeam,
  updateProjectTeam
};
