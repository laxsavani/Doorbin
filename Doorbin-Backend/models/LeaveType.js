const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  code: { type: String, trim: true },
  daysAllowedPerYear: { type: Number, default: 12 },
  description: { type: String, trim: true },
  colorCode: { type: String, default: '#B68D40' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('LeaveType', leaveTypeSchema);
