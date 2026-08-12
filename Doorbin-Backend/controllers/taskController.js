const Task = require('../models/Task');
const Project = require('../models/Project');
const Stage = require('../models/Stage');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const logActivity = require('../utils/activityLogger');
const { recalculateProjectProgress } = require('./projectController');
const { formatDDMMYYYY, parseDateString, calculateWorkingDays } = require('../utils/dateFormatter');
const mongoose = require('mongoose');

// Helper: Check if a date falls on Sunday or an active Studio Holiday
const checkIsSundayOrHoliday = async (dateInput) => {
  if (!dateInput) return null;
  const d = parseDateString(dateInput);
  if (!d) return null;

  if (d.getDay() === 0) {
    return { isBlocked: true, name: 'Sunday (Weekly Off)' };
  }

  const startOfDay = new Date(d);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(d);
  endOfDay.setHours(23, 59, 59, 999);

  const holiday = await Holiday.findOne({
    date: { $gte: startOfDay, $lte: endOfDay }
  });

  if (holiday) {
    return { isBlocked: true, name: holiday.name };
  }

  return { isBlocked: false };
};

// Helper: Status Adjacency Map
const STATUS_TRANSITIONS = {
  'Pending': ['Assigned', 'Cancelled'],
  'Assigned': ['In Progress', 'Cancelled'],
  'In Progress': ['Under Review', 'Cancelled'],
  'Under Review': ['Completed', 'Revision Required', 'Cancelled'],
  'Revision Required': ['In Progress', 'Cancelled'],
  'Completed': ['Approved'],
  'Approved': [],
  'Cancelled': []
};

// Helper: Proportional Sub-Stage Completion Upgrade & Cascade to Module 5
const recalculateSubStageCompletion = async (stageId, subStageId, projectId) => {
  if (!stageId || !subStageId || !projectId) return;

  const tasks = await Task.find({ stage: stageId, subStage: subStageId });
  if (tasks.length === 0) return;

  const completedCount = tasks.filter(t => ['Completed', 'Approved'].includes(t.status)).length;
  const propPercentage = Number(((completedCount / tasks.length) * 100).toFixed(2));

  const stage = await Stage.findOne({ _id: stageId, project: projectId });
  if (!stage) return;

  const subStage = stage.subStages.id(subStageId);
  if (!subStage) return;

  subStage.completionPercentage = propPercentage;
  if (propPercentage === 100) {
    subStage.status = 'Completed';
  } else if (propPercentage > 0) {
    subStage.status = 'In Progress';
  } else {
    subStage.status = 'Pending';
  }

  // Recalculate Stage overall completion %
  if (stage.subStages.length > 0) {
    let totalSub = 0;
    for (const sub of stage.subStages) {
      totalSub += (sub.completionPercentage || 0);
    }
    stage.completionPercentage = Number((totalSub / stage.subStages.length).toFixed(2));

    const allSubCompleted = stage.subStages.every(s => ['Completed', 'Approved'].includes(s.status));
    if (allSubCompleted && !stage.approvalRequired) {
      stage.status = 'Completed';
    } else if (stage.completionPercentage > 0) {
      stage.status = 'In Progress';
    }
  }

  await stage.save();
  await recalculateProjectProgress(projectId);
};

// Helper: Check if caller is PM/Director
const isPMOrDirector = (req) => {
  return req.user?.role?.name === 'Director' ||
    req.user?.role?.permissions?.projectManagement === true ||
    req.user?.role?.permissions?.userManagement === true;
};

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private (Artist / PM / Director - taskManagement or projectManagement)
const createTask = async (req, res) => {
  const {
    project,
    stage,
    subStage,
    taskName,
    parentTask,
    assignee,
    reviewer,
    priority,
    startDate,
    endDate,
    estimatedHours,
    dependencies
  } = req.body;

  if (!project || !mongoose.Types.ObjectId.isValid(project)) {
    return res.status(400).json({ message: 'Valid project ID is required' });
  }
  if (!stage || !mongoose.Types.ObjectId.isValid(stage)) {
    return res.status(400).json({ message: 'Valid stage ID is required' });
  }
  if (!taskName || !taskName.trim()) {
    return res.status(400).json({ message: 'Task name is required' });
  }

  try {
    const projectObj = await Project.findOne({ _id: project, isDeleted: { $ne: true } });
    if (!projectObj) {
      return res.status(400).json({ message: 'Project not found or deleted' });
    }

    const stageObj = await Stage.findOne({ _id: stage, project });
    if (!stageObj) {
      return res.status(400).json({ message: 'Stage not found in specified project' });
    }

    let subStageId = null;
    if (subStage && mongoose.Types.ObjectId.isValid(subStage)) {
      const foundSub = stageObj.subStages.id(subStage);
      if (foundSub) subStageId = subStage;
    }

    const parsedStart = parseDateString(startDate);
    const parsedEnd = parseDateString(endDate, true);

    if (startDate) {
      const startCheck = await checkIsSundayOrHoliday(startDate);
      if (startCheck?.isBlocked) {
        return res.status(400).json({ message: `Cannot schedule task start date on a non-working day (${startCheck.name}). Please select a working business day.` });
      }
    }

    if (endDate) {
      const endCheck = await checkIsSundayOrHoliday(endDate);
      if (endCheck?.isBlocked) {
        return res.status(400).json({ message: `Cannot schedule task due date on a non-working day (${endCheck.name}). Please select a working business day.` });
      }
    }

    const workingDays = await calculateWorkingDays(parsedStart, parsedEnd);
    const initialStatus = assignee ? 'Assigned' : 'Pending';

    const task = await Task.create({
      project,
      stage,
      subStage: subStageId,
      taskName: taskName.trim(),
      parentTask: parentTask && mongoose.Types.ObjectId.isValid(parentTask) ? parentTask : null,
      assignee: assignee && mongoose.Types.ObjectId.isValid(assignee) ? assignee : null,
      reviewer: reviewer && mongoose.Types.ObjectId.isValid(reviewer) ? reviewer : null,
      priority: priority || 'Medium',
      status: initialStatus,
      startDate: parsedStart,
      endDate: parsedEnd,
      estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
      actualHours: 0,
      workingDays,
      dependencies: Array.isArray(dependencies) ? dependencies : [],
      comments: [],
      attachments: [],
      auditHistory: [
        {
          field: 'status',
          oldValue: null,
          newValue: initialStatus,
          changedBy: req.user._id,
          date: new Date()
        }
      ],
      createdBy: req.user._id
    });

    if (subStageId) {
      await recalculateSubStageCompletion(stage, subStageId, project);
    }

    await logActivity({
      req,
      userId: req.user._id,
      action: 'TASK_CREATED',
      targetType: 'Task',
      targetId: task._id,
      metadata: { taskName: task.taskName, status: initialStatus }
    });

    const populatedTask = await Task.findById(task._id)
      .populate('assignee', 'name email role')
      .populate('reviewer', 'name email role')
      .populate('createdBy', 'name email');

    return res.status(201).json(populatedTask);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get paginated tasks (Ownership/Visibility Scoped)
// @route   GET /api/tasks
// @access  Private (Authenticated users)
const getTasks = async (req, res) => {
  try {
    const { project, stage, subStage, assignee, status, priority, page = 1, limit = 20 } = req.query;
    const query = {};

    if (project) query.project = project;
    if (stage) query.stage = stage;
    if (subStage) query.subStage = subStage;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    // Strict User-Level Data Isolation Rule
    const isDirector = req.user?.role?.name === 'Director';
    if (!isDirector) {
      const isPM = req.user?.role?.name === 'Production Manager';
      if (isPM) {
        // PM sees tasks assigned to them OR tasks in projects they manage
        const managedProjects = await Project.find({
          $or: [
            { productionManager: req.user._id },
            { assignedTeam: req.user._id }
          ]
        }).select('_id');
        const managedProjectIds = managedProjects.map(p => p._id);

        query.$or = [
          { assignee: req.user._id },
          { reviewer: req.user._id },
          { project: { $in: managedProjectIds } }
        ];
      } else {
        // Artist / Team Member: STRICT USER DATA ISOLATION (Only tasks assigned to req.user._id or where user is reviewer)
        query.$or = [
          { assignee: req.user._id },
          { reviewer: req.user._id }
        ];
      }
    } else if (assignee) {
      query.assignee = assignee;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const tasks = await Task.find(query)
      .populate('project', 'projectName projectCategory')
      .populate('stage', 'stageName')
      .populate('assignee', 'name email')
      .populate('reviewer', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Task.countDocuments(query);

    return res.json({
      tasks,
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

// @desc    Get current user's assigned tasks (Convenience View)
// @route   GET /api/tasks/my-tasks
// @access  Private (Authenticated users)
const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ assignee: req.user._id })
      .populate('project', 'projectName projectCategory priority')
      .populate('stage', 'stageName')
      .sort({ endDate: 1 });

    return res.json({ count: tasks.length, tasks });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user's tasks active today (Convenience View)
// @route   GET /api/tasks/today
// @access  Private (Authenticated users)
const getTodayTasks = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const query = {
      assignee: req.user._id,
      status: { $nin: ['Completed', 'Approved', 'Cancelled'] },
      $or: [
        { startDate: { $lte: endOfToday }, endDate: { $gte: startOfToday } },
        { endDate: { $lte: endOfToday } }
      ]
    };

    const tasks = await Task.find(query)
      .populate('project', 'projectName projectCategory')
      .populate('stage', 'stageName')
      .sort({ endDate: 1 });

    return res.json({ count: tasks.length, tasks });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get overdue tasks across system (PM / Director)
// @route   GET /api/tasks/overdue
// @access  Private (PM / Director)
const getOverdueTasks = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const overdueTasks = await Task.find({
      endDate: { $lt: startOfToday },
      status: { $nin: ['Completed', 'Approved', 'Cancelled'] }
    })
      .populate('project', 'projectName projectCategory')
      .populate('stage', 'stageName')
      .populate('assignee', 'name email')
      .sort({ endDate: 1 });

    return res.json({ count: overdueTasks.length, overdueTasks });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get single task details with auditHistory & comments
// @route   GET /api/tasks/:id
// @access  Private (Authenticated users - ownership checked)
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('project', 'projectName projectCategory productionManager')
      .populate('stage', 'stageName')
      .populate('parentTask', 'taskName status')
      .populate('assignee', 'name email phone role')
      .populate('reviewer', 'name email phone role')
      .populate('createdBy', 'name email')
      .populate('auditHistory.changedBy', 'name email')
      .populate('comments.user', 'name email');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Ownership check for Artists
    if (!isPMOrDirector(req)) {
      const isAssignee = task.assignee && task.assignee._id.toString() === req.user._id.toString();
      const isReviewer = task.reviewer && task.reviewer._id.toString() === req.user._id.toString();
      if (!isAssignee && !isReviewer) {
        return res.status(403).json({ message: 'Access denied. You do not have permission to view this task.' });
      }
    }

    return res.json(task);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update task details (Field diffing & audit logging)
// @route   PUT /api/tasks/:id
// @access  Private (Assignee / Reviewer / PM / Director)
const updateTask = async (req, res) => {
  const {
    taskName,
    assignee,
    reviewer,
    priority,
    startDate,
    endDate,
    estimatedHours,
    actualHours,
    dependencies
  } = req.body;

  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Ownership check for Artists
    if (!isPMOrDirector(req)) {
      const isAssignee = task.assignee && task.assignee.toString() === req.user._id.toString();
      const isReviewer = task.reviewer && task.reviewer.toString() === req.user._id.toString();
      if (!isAssignee && !isReviewer) {
        return res.status(403).json({ message: 'Access denied. You can only update tasks assigned to or reviewed by you.' });
      }
    }

    if (startDate) {
      const startCheck = await checkIsSundayOrHoliday(startDate);
      if (startCheck?.isBlocked) {
        return res.status(400).json({ message: `Cannot set task start date on a non-working day (${startCheck.name}). Please select a working business day.` });
      }
    }

    if (endDate) {
      const endCheck = await checkIsSundayOrHoliday(endDate);
      if (endCheck?.isBlocked) {
        return res.status(400).json({ message: `Cannot set task due date on a non-working day (${endCheck.name}). Please select a working business day.` });
      }
    }

    const auditHistoryAdditions = [];

    // Helper for diff logging
    const trackDiff = (field, oldVal, newVal) => {
      if (newVal !== undefined && String(oldVal) !== String(newVal)) {
        auditHistoryAdditions.push({
          field,
          oldValue: oldVal,
          newValue: newVal,
          changedBy: req.user._id,
          date: new Date()
        });
      }
    };

    if (taskName !== undefined) {
      trackDiff('taskName', task.taskName, taskName.trim());
      task.taskName = taskName.trim();
    }

    if (assignee !== undefined) {
      trackDiff('assignee', task.assignee, assignee);
      task.assignee = assignee && mongoose.Types.ObjectId.isValid(assignee) ? assignee : null;
      if (task.status === 'Pending' && task.assignee) {
        task.status = 'Assigned';
      }
    }

    if (reviewer !== undefined) {
      trackDiff('reviewer', task.reviewer, reviewer);
      task.reviewer = reviewer && mongoose.Types.ObjectId.isValid(reviewer) ? reviewer : null;
    }

    if (priority && ['High', 'Medium', 'Low'].includes(priority)) {
      trackDiff('priority', task.priority, priority);
      task.priority = priority;
    }

    let datesChanged = false;
    if (startDate !== undefined) {
      trackDiff('startDate', task.startDate, startDate);
      task.startDate = startDate ? new Date(startDate) : undefined;
      datesChanged = true;
    }
    if (endDate !== undefined) {
      trackDiff('endDate', task.endDate, endDate);
      task.endDate = endDate ? new Date(endDate) : undefined;
      datesChanged = true;
    }

    if (datesChanged) {
      task.workingDays = await calculateWorkingDays(task.startDate, task.endDate);
    }

    if (estimatedHours !== undefined) {
      trackDiff('estimatedHours', task.estimatedHours, estimatedHours);
      task.estimatedHours = Number(estimatedHours);
    }

    if (actualHours !== undefined) {
      trackDiff('actualHours', task.actualHours, actualHours);
      task.actualHours = Number(actualHours);
    }

    if (Array.isArray(dependencies)) {
      task.dependencies = dependencies;
    }

    auditHistoryAdditions.forEach(entry => task.auditHistory.push(entry));

    await task.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'TASK_UPDATED',
      targetType: 'Task',
      targetId: task._id,
      metadata: { taskName: task.taskName, fieldsChanged: auditHistoryAdditions.map(a => a.field) }
    });

    const updatedTask = await Task.findById(task._id)
      .populate('assignee', 'name email')
      .populate('reviewer', 'name email');

    return res.json(updatedTask);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update task status (Strict State Machine & Module 5 Cascade)
// @route   PUT /api/tasks/:id/status
// @access  Private (Assignee / Reviewer / PM / Director)
const updateTaskStatus = async (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Target status is required' });
  }

  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const currentStatus = task.status;
    const allowedNext = STATUS_TRANSITIONS[currentStatus] || [];

    if (currentStatus !== status && !allowedNext.includes(status)) {
      return res.status(400).json({
        message: `Invalid status transition from '${currentStatus}' to '${status}'. Allowed next statuses: [${allowedNext.join(', ')}].`
      });
    }

    // Role & Verdict Enforcement
    const isPM = isPMOrDirector(req);
    const isReviewer = task.reviewer && task.reviewer.toString() === req.user._id.toString();
    const isAssignee = task.assignee && task.assignee.toString() === req.user._id.toString();

    // Assignee cannot self-approve/self-complete review verdicts
    if (['Completed', 'Approved', 'Revision Required'].includes(status)) {
      if (!isReviewer && !isPM) {
        return res.status(403).json({ message: 'Access denied. Only the assigned reviewer or Production Manager can issue review verdicts.' });
      }
    }

    // Cancelled requires PM/Director
    if (status === 'Cancelled' && !isPM) {
      return res.status(403).json({ message: 'Access denied. Only Production Manager or Director can cancel a task.' });
    }

    task.status = status;
    task.auditHistory.push({
      field: 'status',
      oldValue: currentStatus,
      newValue: status,
      changedBy: req.user._id,
      date: new Date()
    });

    await task.save();

    // Module 5 Cascade Upgrade
    if (task.subStage) {
      await recalculateSubStageCompletion(task.stage, task.subStage, task.project);
    }

    await logActivity({
      req,
      userId: req.user._id,
      action: 'TASK_STATUS_UPDATED',
      targetType: 'Task',
      targetId: task._id,
      metadata: { taskName: task.taskName, previousStatus: currentStatus, newStatus: status }
    });

    const updatedTask = await Task.findById(task._id)
      .populate('assignee', 'name email')
      .populate('reviewer', 'name email');

    return res.json(updatedTask);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Upload attachments to task
// @route   POST /api/tasks/:id/upload
// @access  Private (Assignee / PM / Director)
const uploadTaskFiles = async (req, res) => {
  const { attachments } = req.body;

  if (!Array.isArray(attachments) || attachments.length === 0) {
    return res.status(400).json({ message: 'attachments array with file paths/urls is required' });
  }

  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    attachments.forEach(file => task.attachments.push(file));
    await task.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'TASK_FILES_UPLOADED',
      targetType: 'Task',
      targetId: task._id,
      metadata: { taskName: task.taskName, count: attachments.length }
    });

    return res.status(201).json(task.attachments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Submit work for review (Status -> Under Review)
// @route   POST /api/tasks/:id/submit
// @access  Private (Assignee / PM / Director)
const submitTaskWork = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (task.attachments.length === 0) {
      return res.status(400).json({ message: 'Cannot submit work for review with 0 file attachments uploaded.' });
    }

    const oldStatus = task.status;
    task.status = 'Under Review';
    task.auditHistory.push({
      field: 'status',
      oldValue: oldStatus,
      newValue: 'Under Review',
      changedBy: req.user._id,
      date: new Date()
    });

    await task.save();

    if (task.subStage) {
      await recalculateSubStageCompletion(task.stage, task.subStage, task.project);
    }

    await logActivity({
      req,
      userId: req.user._id,
      action: 'TASK_WORK_SUBMITTED',
      targetType: 'Task',
      targetId: task._id,
      metadata: { taskName: task.taskName }
    });

    return res.json({ message: 'Work submitted for review successfully.', task });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Review submitted work (Completed / Revision Required / Approved)
// @route   POST /api/tasks/:id/review
// @access  Private (Reviewer / PM / Director)
const reviewTaskWork = async (req, res) => {
  const { decision, reviewComment } = req.body;

  if (!decision || !['Completed', 'Revision Required', 'Approved'].includes(decision)) {
    return res.status(400).json({ message: 'Valid decision (Completed, Revision Required, Approved) is required' });
  }

  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const isPM = isPMOrDirector(req);
    const isReviewer = task.reviewer && task.reviewer.toString() === req.user._id.toString();

    if (!isReviewer && !isPM) {
      return res.status(403).json({ message: 'Access denied. Only assigned reviewer or PM can submit review verdicts.' });
    }

    const oldStatus = task.status;
    task.status = decision;

    if (reviewComment && reviewComment.trim()) {
      task.comments.push({
        user: req.user._id,
        text: `[Review Verdict: ${decision}] ${reviewComment.trim()}`,
        date: new Date()
      });
    }

    task.auditHistory.push({
      field: 'status',
      oldValue: oldStatus,
      newValue: decision,
      changedBy: req.user._id,
      date: new Date()
    });

    await task.save();

    if (task.subStage) {
      await recalculateSubStageCompletion(task.stage, task.subStage, task.project);
    }

    await logActivity({
      req,
      userId: req.user._id,
      action: 'TASK_REVIEWED',
      targetType: 'Task',
      targetId: task._id,
      metadata: { decision, taskName: task.taskName }
    });

    return res.json({ message: `Review verdict '${decision}' recorded successfully.`, task });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Add comment to task
// @route   POST /api/tasks/:id/comments
// @access  Private (Assignee / Reviewer / PM / Director)
const addTaskComment = async (req, res) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'Comment text is required' });
  }

  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.comments.push({
      user: req.user._id,
      text: text.trim(),
      date: new Date()
    });

    await task.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'TASK_COMMENT_ADDED',
      targetType: 'Task',
      targetId: task._id,
      metadata: { taskName: task.taskName }
    });

    const updatedTask = await Task.findById(task._id).populate('comments.user', 'name email');
    return res.status(201).json(updatedTask.comments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private (PM / Director)
const deleteTask = async (req, res) => {
  if (!isPMOrDirector(req)) {
    return res.status(403).json({ message: 'Access denied. PM or Director role required to delete tasks.' });
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid task ID' });
  }

  try {
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const { project, stage, subStage, taskName } = task;

    await Task.findByIdAndDelete(id);

    // Recalculate sub-stage completion & project progress after task deletion
    if (stage && subStage && project) {
      await recalculateSubStageCompletion(stage, subStage, project);
    }

    await logActivity({
      req,
      userId: req.user._id,
      action: 'TASK_DELETED',
      targetType: 'Task',
      targetId: id,
      metadata: { taskName, project }
    });

    return res.json({ message: `Task '${taskName}' deleted successfully` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Assign or reassign task assignee / reviewer
// @route   PATCH /api/tasks/:id/assign
// @access  Private (PM / Director)
const assignTask = async (req, res) => {
  const { assignee, reviewer } = req.body;

  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (assignee !== undefined) {
      task.auditHistory.push({
        field: 'assignee',
        oldValue: task.assignee ? task.assignee.toString() : 'None',
        newValue: String(assignee),
        changedBy: req.user._id,
        changedAt: new Date()
      });
      task.assignee = assignee;
    }

    if (reviewer !== undefined) {
      task.auditHistory.push({
        field: 'reviewer',
        oldValue: task.reviewer ? task.reviewer.toString() : 'None',
        newValue: String(reviewer),
        changedBy: req.user._id,
        changedAt: new Date()
      });
      task.reviewer = reviewer;
    }

    await task.save();
    const updated = await Task.findById(task._id)
      .populate('assignee', 'name email')
      .populate('reviewer', 'name email');

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get task comments
// @route   GET /api/tasks/:id/comments
// @access  Private (Authenticated Users)
const getTaskComments = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('comments.user', 'name email');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    return res.json(task.comments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get task audit log history
// @route   GET /api/tasks/:id/audit-log
// @access  Private (Authenticated Users)
const getTaskAuditLog = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('auditHistory.changedBy', 'name email');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    return res.json(task.auditHistory);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get task dependencies
// @route   GET /api/tasks/:id/dependencies
// @access  Private (Authenticated Users)
const getTaskDependencies = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('dependencies', 'taskName status startDate endDate');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    return res.json(task.dependencies);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Add / update task dependencies
// @route   POST /api/tasks/:id/dependencies
// @access  Private (PM / Director / Assignee)
const addTaskDependencies = async (req, res) => {
  const { dependencies } = req.body;
  if (!Array.isArray(dependencies)) {
    return res.status(400).json({ message: 'dependencies array is required' });
  }

  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.dependencies = dependencies;
    await task.save();

    const updated = await Task.findById(task._id).populate('dependencies', 'taskName status startDate endDate');
    return res.json(updated.dependencies);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createTask,
  getTasks,
  getMyTasks,
  getTodayTasks,
  getOverdueTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  assignTask,
  uploadTaskFiles,
  submitTaskWork,
  reviewTaskWork,
  addTaskComment,
  getTaskComments,
  getTaskAuditLog,
  getTaskDependencies,
  addTaskDependencies,
  deleteTask
};
