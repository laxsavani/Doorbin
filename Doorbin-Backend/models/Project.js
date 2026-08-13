const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  projectName:     { type: String, required: true, trim: true },
  client:          { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  originEnquiry:   { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry', default: null },
  projectCategory: { type: String, enum: ['Architecture', 'Interior Design', 'Animation'], required: true },
  projectSubType:  { type: String, trim: true },
  priority:        { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  budget:          { type: Number, min: 0 },
  startDate:       { type: Date, required: true },
  endDate:         { type: Date, required: true },
  billingParty:    { type: String, trim: true },

  productionManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTeam:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Delayed', 'Pending Approval', 'Approved', 'Rejected', 'Cancelled', 'pending_approval', 'approved', 'rejected', 'in_progress', 'on_hold', 'completed', 'cancelled'],
    default: 'Not Started'
  },
  progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
  progressPercent:    { type: Number, default: 0, min: 0, max: 100 },
  isDelayed:          { type: Boolean, default: false },
  approvedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalDate:       { type: Date },
  isDeleted:          { type: Boolean, default: false },

  attachments: [{ type: String }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String },
    date: { type: Date, default: Date.now }
  }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

projectSchema.index({ projectName: 'text', projectSubType: 'text' });
projectSchema.index({ isDeleted: 1, status: 1 });
projectSchema.index({ client: 1, isDeleted: 1 });
projectSchema.index({ productionManager: 1, isDeleted: 1 });
projectSchema.index({ assignedTeam: 1, isDeleted: 1 });

module.exports = mongoose.model('Project', projectSchema);
