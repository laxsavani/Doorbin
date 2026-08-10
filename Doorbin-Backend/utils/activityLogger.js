const ActivityLog = require('../models/ActivityLog');

const logActivity = async ({ req, userId, action, targetType, targetId, metadata }) => {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip) : undefined;
    await ActivityLog.create({
      user: userId,
      action,
      targetType,
      targetId,
      ipAddress,
      metadata,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
};

module.exports = logActivity;
