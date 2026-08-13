const Enquiry = require('../models/Enquiry');
const Client = require('../models/Client');
const Project = require('../models/Project');
const User = require('../models/User');
const logActivity = require('../utils/activityLogger');
const mongoose = require('mongoose');

const ACTIVE_STAGES = ['New Enquiry', 'Qualification', 'Meeting', 'Proposal', 'Negotiation'];
const CLOSED_STAGES = ['Won', 'Lost', 'Project Creation'];

// Helper to validate sequential stage transition
const validateStageTransition = (currentStatus, targetStatus, lostReason) => {
  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  // Rule 1: Closed deals cannot change stage
  if (CLOSED_STAGES.includes(currentStatus)) {
    return { valid: false, message: `Enquiry is closed (${currentStatus}). Further stage transitions are blocked.` };
  }

  // Rule 2: Cannot set 'Project Creation' via general status endpoint
  if (targetStatus === 'Project Creation') {
    return { valid: false, message: "Status 'Project Creation' can only be set via the project conversion handoff endpoint." };
  }

  // Rule 3: 'Lost' can be set from any active stage, requires lostReason
  if (targetStatus === 'Lost') {
    if (!lostReason || !lostReason.trim()) {
      return { valid: false, message: 'lostReason is required when marking an enquiry as Lost.' };
    }
    return { valid: true };
  }

  // Rule 4: 'Won' can be set from any active stage
  if (targetStatus === 'Won') {
    return { valid: true };
  }

  // Rule 5: Active stage transitions must be single-step sequential
  const currentIndex = ACTIVE_STAGES.indexOf(currentStatus);
  const targetIndex = ACTIVE_STAGES.indexOf(targetStatus);

  if (currentIndex === -1 || targetIndex === -1) {
    return { valid: false, message: `Invalid status specified: ${targetStatus}` };
  }

  if (targetIndex !== currentIndex + 1) {
    return {
      valid: false,
      message: `Invalid stage transition. Must move sequentially from '${currentStatus}' to '${ACTIVE_STAGES[currentIndex + 1]}'.`
    };
  }

  return { valid: true };
};

// @desc    Create a new enquiry
// @route   POST /api/enquiries
// @access  Private (BD Manager / Director - businessDevAccess)
const createEnquiry = async (req, res) => {
  const {
    clientName,
    architectName,
    projectName,
    projectType,
    estimatedValue,
    source,
    assignedExecutive,
    followUpDate,
    priority,
    clientCategory,
    notes,
    existingClient
  } = req.body;

  if (!clientName || !clientName.trim()) {
    return res.status(400).json({ message: 'Client name is required' });
  }
  if (!projectName || !projectName.trim()) {
    return res.status(400).json({ message: 'Project name is required' });
  }
  if (!projectType || !['Architecture', 'Interior Design', 'Animation'].includes(projectType)) {
    return res.status(400).json({ message: 'Valid projectType (Architecture, Interior Design, Animation) is required' });
  }
  if (!assignedExecutive || !mongoose.Types.ObjectId.isValid(assignedExecutive)) {
    return res.status(400).json({ message: 'Valid assignedExecutive user ID is required' });
  }

  try {
    const executiveUser = await User.findById(assignedExecutive);
    if (!executiveUser) {
      return res.status(400).json({ message: 'Assigned executive user does not exist' });
    }

    let validClient = null;
    if (existingClient && mongoose.Types.ObjectId.isValid(existingClient)) {
      const clientObj = await Client.findById(existingClient);
      if (clientObj) {
        validClient = clientObj._id;
      }
    }

    const initialStatus = 'New Enquiry';
    const enquiry = await Enquiry.create({
      clientName: clientName.trim(),
      architectName: architectName ? architectName.trim() : undefined,
      projectName: projectName.trim(),
      projectType,
      estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
      source: source ? source.trim() : undefined,
      assignedExecutive,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      priority: priority || 'Medium',
      clientCategory: clientCategory || undefined,
      leadTemperature: req.body.leadTemperature || 'Warm',
      notes,
      existingClient: validClient,
      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          changedAt: new Date(),
          changedBy: req.user._id
        }
      ],
      activityLog: [],
      createdBy: req.user._id
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ENQUIRY_CREATED',
      targetType: 'Enquiry',
      targetId: enquiry._id,
      metadata: { projectName: enquiry.projectName, clientName: enquiry.clientName }
    });

    const populatedEnquiry = await Enquiry.findById(enquiry._id)
      .populate('assignedExecutive', 'name email role')
      .populate('createdBy', 'name email role')
      .populate('existingClient', 'companyName clientName email');

    return res.status(201).json(populatedEnquiry);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get paginated enquiries with filters
// @route   GET /api/enquiries
// @access  Private (BD Manager, Director)
const getEnquiries = async (req, res) => {
  try {
    const { status, priority, assignedExecutive, clientCategory, followUpDue, search, page = 1, limit = 20 } = req.query;
    const query = {};

    const isDirectorOrBDManager = req.user?.role?.name === 'Director' || req.user?.role?.name === 'Business Development Manager';
    if (!isDirectorOrBDManager) {
      query.$or = [
        { assignedExecutive: req.user._id },
        { createdBy: req.user._id }
      ];
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedExecutive) query.assignedExecutive = assignedExecutive;
    if (clientCategory) query.clientCategory = clientCategory;

    if (followUpDue === 'today') {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      query.followUpDate = { $lte: endOfToday };
      query.status = { $nin: CLOSED_STAGES }; // exclude closed deals from follow-up due
    }

    if (search && search.trim()) {
      query.$text = { $search: search.trim() };
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const enquiries = await Enquiry.find(query)
      .populate('assignedExecutive', 'name email')
      .populate('createdBy', 'name email')
      .populate('existingClient', 'companyName clientName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Enquiry.countDocuments(query);

    return res.json({
      enquiries,
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

// @desc    Get single enquiry detail
// @route   GET /api/enquiries/:id
// @access  Private (BD Manager, Director)
const getEnquiryById = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id)
      .populate('assignedExecutive', 'name email phone role')
      .populate('createdBy', 'name email role')
      .populate('existingClient', 'companyName clientName email phone')
      .populate('statusHistory.changedBy', 'name email')
      .populate('activityLog.createdBy', 'name email');

    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    return res.json(enquiry);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update enquiry details (except status)
// @route   PUT /api/enquiries/:id
// @access  Private (BD Manager / Director - businessDevAccess)
const updateEnquiry = async (req, res) => {
  const {
    clientName,
    architectName,
    projectName,
    projectType,
    estimatedValue,
    source,
    assignedExecutive,
    followUpDate,
    priority,
    clientCategory,
    notes,
    existingClient
  } = req.body;

  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    if (clientName !== undefined) enquiry.clientName = clientName.trim();
    if (architectName !== undefined) enquiry.architectName = architectName.trim();
    if (projectName !== undefined) enquiry.projectName = projectName.trim();
    if (projectType && ['Architecture', 'Interior Design', 'Animation'].includes(projectType)) {
      enquiry.projectType = projectType;
    }
    if (estimatedValue !== undefined) enquiry.estimatedValue = Number(estimatedValue);
    if (source !== undefined) enquiry.source = source.trim();

    if (assignedExecutive && mongoose.Types.ObjectId.isValid(assignedExecutive)) {
      const execUser = await User.findById(assignedExecutive);
      if (execUser) enquiry.assignedExecutive = assignedExecutive;
    }

    if (followUpDate !== undefined) {
      enquiry.followUpDate = followUpDate ? new Date(followUpDate) : undefined;
    }
    if (priority && ['High', 'Medium', 'Low'].includes(priority)) enquiry.priority = priority;
    if (clientCategory && ['Aspirational', 'Regulation', 'Red Flag'].includes(clientCategory)) {
      enquiry.clientCategory = clientCategory;
    }
    if (req.body.leadTemperature && ['Hot', 'Warm', 'Cold'].includes(req.body.leadTemperature)) {
      enquiry.leadTemperature = req.body.leadTemperature;
    }
    if (notes !== undefined) enquiry.notes = notes;

    if (existingClient !== undefined) {
      if (existingClient && mongoose.Types.ObjectId.isValid(existingClient)) {
        const clientObj = await Client.findById(existingClient);
        if (clientObj) enquiry.existingClient = existingClient;
      } else {
        enquiry.existingClient = null;
      }
    }

    const updatedEnquiry = await enquiry.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ENQUIRY_UPDATED',
      targetType: 'Enquiry',
      targetId: updatedEnquiry._id,
      metadata: { projectName: updatedEnquiry.projectName }
    });

    const populatedEnquiry = await Enquiry.findById(updatedEnquiry._id)
      .populate('assignedExecutive', 'name email')
      .populate('createdBy', 'name email')
      .populate('existingClient', 'companyName clientName');

    return res.json(populatedEnquiry);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update enquiry stage/status (State Machine)
// @route   PUT /api/enquiries/:id/status
// @access  Private (BD Manager / Director - businessDevAccess)
const updateEnquiryStatus = async (req, res) => {
  const { status, lostReason } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Target status is required' });
  }

  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    const check = validateStageTransition(enquiry.status, status, lostReason);
    if (!check.valid) {
      return res.status(400).json({ message: check.message });
    }

    const oldStatus = enquiry.status;
    enquiry.status = status;

    if (status === 'Lost') {
      enquiry.lostReason = lostReason.trim();
    }

    enquiry.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user._id
    });

    const updatedEnquiry = await enquiry.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ENQUIRY_STATUS_UPDATED',
      targetType: 'Enquiry',
      targetId: updatedEnquiry._id,
      metadata: { previousStatus: oldStatus, newStatus: status, projectName: updatedEnquiry.projectName }
    });

    const populatedEnquiry = await Enquiry.findById(updatedEnquiry._id)
      .populate('assignedExecutive', 'name email')
      .populate('statusHistory.changedBy', 'name email');

    return res.json(populatedEnquiry);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Add activity log entry to enquiry
// @route   POST /api/enquiries/:id/activity
// @access  Private (BD Manager / Director - businessDevAccess)
const addActivityLog = async (req, res) => {
  const { type, description, attachments } = req.body;

  if (!type || !['Call', 'Email', 'Meeting', 'Note'].includes(type)) {
    return res.status(400).json({ message: 'Valid type (Call, Email, Meeting, Note) is required' });
  }
  if (!description || !description.trim()) {
    return res.status(400).json({ message: 'Activity description is required' });
  }

  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    const followUpDateObj = req.body.followUpDate ? new Date(req.body.followUpDate) : null;

    enquiry.activityLog.push({
      type,
      description: description.trim(),
      date: new Date(),
      followUpDate: followUpDateObj,
      createdBy: req.user._id,
      attachments: Array.isArray(attachments) ? attachments : []
    });

    if (followUpDateObj) {
      enquiry.followUpDate = followUpDateObj;
    }

    await enquiry.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ENQUIRY_ACTIVITY_LOGGED',
      targetType: 'Enquiry',
      targetId: enquiry._id,
      metadata: { activityType: type }
    });

    const updatedEnquiry = await Enquiry.findById(enquiry._id)
      .populate('assignedExecutive', 'name email')
      .populate('activityLog.createdBy', 'name email');

    return res.status(201).json({
      enquiry: updatedEnquiry,
      activityLog: updatedEnquiry.activityLog
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get enquiry activity logs (most recent first)
// @route   GET /api/enquiries/:id/activity
// @access  Private (BD Manager, Director)
const getActivityLogs = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id).populate('activityLog.createdBy', 'name email');
    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    const sortedLogs = [...enquiry.activityLog].sort((a, b) => b.date - a.date);
    return res.json(sortedLogs);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Convert Won enquiry to Client payload (Handoff for Module 5)
// @route   POST /api/enquiries/:id/convert
// @access  Private (BD Manager / Director - businessDevAccess)
const convertEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    if (enquiry.status !== 'Won') {
      return res.status(400).json({ message: "Only enquiries in 'Won' status can be converted to projects." });
    }

    let clientObj;

    // Step 1: Reuse existingClient if set
    if (enquiry.existingClient) {
      clientObj = await Client.findById(enquiry.existingClient);
    }

    // Step 2: Auto-create Client in Module 3 if not set
    if (!clientObj) {
      const generateEmail = `${enquiry.clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}@prospect.com`;
      clientObj = await Client.create({
        companyName: enquiry.clientName,
        clientName: enquiry.clientName,
        email: generateEmail,
        phone: 'N/A',
        notes: `Auto-created from Won Enquiry: ${enquiry.projectName}`,
        createdBy: req.user._id
      });

      enquiry.existingClient = clientObj._id;
      await enquiry.save();
    }

    // Step 3: Auto-create Project in pending_approval status & link convertedProject
    let projectObj;
    if (enquiry.convertedProject) {
      projectObj = await Project.findById(enquiry.convertedProject);
    }

    if (!projectObj) {
      projectObj = await Project.create({
        projectName: enquiry.projectName,
        client: clientObj._id,
        originEnquiry: enquiry._id,
        projectCategory: enquiry.projectType || 'Architecture',
        budget: enquiry.estimatedValue || 0,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
        productionManager: req.user._id,
        status: 'pending_approval',
        createdBy: req.user._id
      });

      enquiry.convertedProject = projectObj._id;
      enquiry.status = 'Project Creation';
      await enquiry.save();
    }

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ENQUIRY_CONVERTED_PROJECT_CREATED',
      targetType: 'Enquiry',
      targetId: enquiry._id,
      metadata: { clientId: clientObj._id, projectId: projectObj._id }
    });

    return res.json({
      message: 'Enquiry converted successfully! New Project created in pending_approval status.',
      clientId: clientObj._id,
      projectId: projectObj._id,
      project: projectObj
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Mark enquiry as converted after Module 5 project creation
// @route   PUT /api/enquiries/:id/mark-converted
// @access  Private (BD Manager / Director - businessDevAccess)
const markConverted = async (req, res) => {
  const { projectId } = req.body;

  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: 'Valid projectId is required' });
  }

  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    if (enquiry.status === 'Project Creation') {
      return res.status(400).json({ message: 'Enquiry is already marked as converted to project.' });
    }
    if (enquiry.status !== 'Won') {
      return res.status(400).json({ message: "Enquiry must be in 'Won' status before marking converted." });
    }

    const oldStatus = enquiry.status;
    enquiry.convertedProject = projectId;
    enquiry.status = 'Project Creation';
    enquiry.statusHistory.push({
      status: 'Project Creation',
      changedAt: new Date(),
      changedBy: req.user._id
    });

    await enquiry.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ENQUIRY_CONVERTED_TO_PROJECT',
      targetType: 'Enquiry',
      targetId: enquiry._id,
      metadata: { previousStatus: oldStatus, projectId }
    });

    return res.json({ message: 'Enquiry successfully marked as converted to Project.', enquiry });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    BD Report 1: Pipeline Funnel Count per status
// @route   GET /api/enquiries/reports/pipeline
// @access  Private (BD Manager, Director)
const getPipelineReport = async (req, res) => {
  try {
    const allStages = ['New Enquiry', 'Qualification', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Project Creation'];

    const counts = await Enquiry.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    counts.forEach((c) => { countMap[c._id] = c.count; });

    const pipeline = allStages.map((stage) => ({
      stage,
      count: countMap[stage] || 0
    }));

    const totalEnquiries = await Enquiry.countDocuments();

    return res.json({ totalEnquiries, pipeline });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    BD Report 2: Lead Conversion Rate (Won / (Won + Lost))
// @route   GET /api/enquiries/reports/conversion
// @access  Private (BD Manager, Director)
const getConversionReport = async (req, res) => {
  try {
    const wonCount = await Enquiry.countDocuments({ status: { $in: ['Won', 'Project Creation'] } });
    const lostCount = await Enquiry.countDocuments({ status: 'Lost' });
    const closedCount = wonCount + lostCount;

    const conversionRatePercent = closedCount > 0 ? Number(((wonCount / closedCount) * 100).toFixed(2)) : 0;

    return res.json({
      wonDeals: wonCount,
      lostDeals: lostCount,
      totalClosedDeals: closedCount,
      conversionRatePercent
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    BD Report 3: Lost Opportunities Report
// @route   GET /api/enquiries/reports/lost
// @access  Private (BD Manager, Director)
const getLostReport = async (req, res) => {
  try {
    const lostEnquiries = await Enquiry.find({ status: 'Lost' })
      .populate('assignedExecutive', 'name email')
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 });

    return res.json({
      totalLost: lostEnquiries.length,
      enquiries: lostEnquiries
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    BD Report 4: Follow-up & Reminder Report (Overdue & Due Today)
// @route   GET /api/enquiries/reports/follow-up
// @access  Private (BD Manager, Director)
const getFollowUpReport = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const activeFilter = { status: { $nin: CLOSED_STAGES } };

    const overdue = await Enquiry.find({
      ...activeFilter,
      followUpDate: { $lt: startOfToday }
    }).populate('assignedExecutive', 'name email').sort({ followUpDate: 1 });

    const dueToday = await Enquiry.find({
      ...activeFilter,
      followUpDate: { $gte: startOfToday, $lte: endOfToday }
    }).populate('assignedExecutive', 'name email').sort({ followUpDate: 1 });

    return res.json({
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      overdue,
      dueToday
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    BD Report 5: Revenue Forecast Report (Sum of estimatedValue for open deals)
// @route   GET /api/enquiries/reports/revenue-forecast
// @access  Private (Finance, BD Manager, Director)
const getRevenueForecastReport = async (req, res) => {
  try {
    const openEnquiries = await Enquiry.find({
      status: { $nin: CLOSED_STAGES }
    }).populate('assignedExecutive', 'name email');

    let totalForecastValue = 0;
    const stageBreakdown = {};

    openEnquiries.forEach((enq) => {
      const val = enq.estimatedValue || 0;
      totalForecastValue += val;
      if (!stageBreakdown[enq.status]) {
        stageBreakdown[enq.status] = { count: 0, totalEstimatedValue: 0 };
      }
      stageBreakdown[enq.status].count += 1;
      stageBreakdown[enq.status].totalEstimatedValue += val;
    });

    return res.json({
      activeOpenDealsCount: openEnquiries.length,
      totalForecastValue,
      stageBreakdown,
      openEnquiries
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an enquiry
// @route   DELETE /api/enquiries/:id
// @access  Private (BD Manager / Director - businessDevAccess)
const deleteEnquiry = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid enquiry ID' });
  }

  try {
    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    const { projectName } = enquiry;
    await Enquiry.findByIdAndDelete(id);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ENQUIRY_DELETED',
      targetType: 'Enquiry',
      targetId: id,
      metadata: { projectName }
    });

    return res.json({ message: `Enquiry '${projectName}' deleted successfully` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Add attachment to enquiry
// @route   POST /api/enquiries/:id/attachments
// @access  Private (BD Manager / Director - businessDevAccess)
const addEnquiryAttachment = async (req, res) => {
  const { fileUrl } = req.body;
  if (!fileUrl) return res.status(400).json({ message: 'fileUrl is required' });

  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ message: 'Enquiry not found' });

    if (!Array.isArray(enquiry.activities)) {
      enquiry.activities = [];
    }

    enquiry.activities.push({
      activityType: 'Attachment Uploaded',
      notes: `Attachment uploaded: ${fileUrl}`,
      fileUrl,
      loggedBy: req.user._id,
      timestamp: new Date()
    });

    await enquiry.save();
    return res.status(201).json({ message: 'Attachment added', fileUrl });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  updateEnquiry,
  updateEnquiryStatus,
  addActivityLog,
  getActivityLogs,
  addEnquiryAttachment,
  convertEnquiry,
  markConverted,
  getPipelineReport,
  getConversionReport,
  getLostReport,
  getFollowUpReport,
  getRevenueForecastReport,
  deleteEnquiry
};
