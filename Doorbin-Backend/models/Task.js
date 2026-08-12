const mongoose = require('mongoose');

const auditEntrySchema = new mongoose.Schema({
  field:     { type: String, required: true },
  oldValue:  { type: mongoose.Schema.Types.Mixed },
  newValue:  { type: mongoose.Schema.Types.Mixed },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:      { type: Date, default: Date.now }
}, { _id: true });

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  date: { type: Date, default: Date.now }
}, { _id: true });

const taskSchema = new mongoose.Schema({
  project:  { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  stage:    { type: mongoose.Schema.Types.ObjectId, ref: 'Stage', required: true },
  subStage: { type: mongoose.Schema.Types.ObjectId, default: null }, // sub-document _id within Stage.subStages

  taskName:   { type: String, required: true, trim: true },
  parentTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },

  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  status: {
    type: String,
    enum: ['Pending', 'Assigned', 'In Progress', 'Under Review', 'Revision Required', 'Completed', 'Approved', 'Cancelled'],
    default: 'Pending'
  },

  startDate: { type: Date },
  endDate:   { type: Date },
  estimatedHours: { type: Number, min: 0 },
  actualHours:    { type: Number, default: 0, min: 0 },
  workingDays:    { type: Number, default: 0, min: 0 },
  clientReviewRequired: { type: Boolean, default: false },
  clientReviewStatus:   { type: String, enum: ['Pending', 'Approved', 'Changes Requested'], default: 'Pending' },

  dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],

  comments:     [commentSchema],
  attachments:  [{ type: String }],
  auditHistory: [auditEntrySchema],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

taskSchema.index({ taskName: 'text' });

module.exports = mongoose.model('Task', taskSchema);
