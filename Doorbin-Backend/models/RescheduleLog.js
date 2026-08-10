const mongoose = require('mongoose');

const rescheduleLogSchema = new mongoose.Schema({
  task:          { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  project:       { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  oldStartDate:  { type: Date },
  oldEndDate:    { type: Date },
  newStartDate:  { type: Date },
  newEndDate:    { type: Date },
  cascaded:      { type: Boolean, default: false },
  cascadedTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  rescheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason:        { type: String, trim: true }
}, { timestamps: true });

rescheduleLogSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model('RescheduleLog', rescheduleLogSchema);
