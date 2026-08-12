const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:     { type: Date, required: true },
  status:   { 
    type: String, 
    enum: ['Present', 'Absent', 'Half-day', 'On Leave', 'Holiday', 'Week Off', 'present', 'absent', 'half_day', 'on_leave', 'holiday', 'week_off'], 
    default: 'Present' 
  },
  checkIn:  { type: Date },
  checkOut: { type: Date },
  clockIn:  { type: Date },
  clockOut: { type: Date },
  workingHours: { type: Number, default: 0 },
  isLate: { type: Boolean, default: false },
  isEarlyLeave: { type: Boolean, default: false },
  editedManually: { type: Boolean, default: false },
  remarks: { type: String, default: '' },
  source: { type: String, enum: ['biometric', 'app', 'manual_entry'], default: 'manual_entry' },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

attendanceSchema.pre('save', function (next) {
  if (this.clockIn && !this.checkIn) this.checkIn = this.clockIn;
  if (this.checkOut && !this.clockOut) this.clockOut = this.checkOut;
  if (this.checkIn && !this.clockIn) this.clockIn = this.checkIn;
  if (this.clockOut && !this.checkOut) this.clockOut = this.checkOut;
  next();
});

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);

