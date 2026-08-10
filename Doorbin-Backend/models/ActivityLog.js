const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action:     { type: String, required: true },
  targetType: { type: String },
  targetId:   { type: mongoose.Schema.Types.ObjectId },
  ipAddress:  { type: String },
  metadata:   { type: mongoose.Schema.Types.Mixed },
  timestamp:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
