const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:     { type: String, required: true, trim: true },
  message:   { type: String, required: true, trim: true },
  type:      { type: String, enum: ['INFO', 'SUCCESS', 'WARNING', 'TASK', 'PROJECT', 'FINANCE', 'LEAVE'], default: 'INFO' },
  read:      { type: Boolean, default: false },
  linkUrl:   { type: String, trim: true },
  metadata:  { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
