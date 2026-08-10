const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  employee:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType:  { type: String, required: true, trim: true },
  fromDate:   { type: Date, required: true },
  toDate:     { type: Date, required: true },
  reason:     { type: String, trim: true },
  status:     { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date }
}, { timestamps: true });

leaveSchema.index({ employee: 1 });
leaveSchema.index({ status: 1 });
leaveSchema.index({ fromDate: 1, toDate: 1 });

module.exports = mongoose.model('Leave', leaveSchema);
