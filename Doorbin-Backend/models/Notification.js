const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title:     { type: String, required: true, trim: true },
  message:   { type: String, required: true, trim: true },
  type:      { type: String, enum: ['INFO', 'SUCCESS', 'WARNING', 'TASK', 'PROJECT', 'FINANCE', 'LEAVE', 'CRM', 'HR', 'SYSTEM'], default: 'INFO' },
  read:      { type: Boolean, default: false },
  isRead:    { type: Boolean, default: false },
  linkUrl:   { type: String, trim: true },
  refId:     { type: mongoose.Schema.Types.ObjectId },
  metadata:  { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

notificationSchema.pre('save', function (next) {
  if (this.user && !this.recipient) this.recipient = this.user;
  if (this.recipient && !this.user) this.user = this.recipient;
  if (this.isRead !== undefined && this.read === false) this.read = this.isRead;
  if (this.read !== undefined && this.isRead === false) this.isRead = this.read;
  next();
});

notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

