const ActivityLog = require('../models/ActivityLog');

// @desc    Get activity logs (Audit Trail)
// @route   GET /api/activity-logs
// @access  Private (Director / userManagement)
const getActivityLogs = async (req, res) => {
  try {
    const { user, action, from, to, page = 1, limit = 20 } = req.query;
    const query = {};

    if (user) query.user = user;
    if (action) query.action = action;
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const logs = await ActivityLog.find(query)
      .populate('user', 'name email role')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await ActivityLog.countDocuments(query);

    return res.json({
      logs,
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

module.exports = {
  getActivityLogs
};
