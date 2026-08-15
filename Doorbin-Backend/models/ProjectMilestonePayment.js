const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  milestoneNumber: { type: Number, required: true, min: 1, max: 5 },
  amount: { type: Number, default: null },
  dateReceived: { type: Date, default: null },
  status: { type: String, enum: ['Due', 'WIP', 'Received'], default: 'Due' },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null }
}, { _id: true });

const projectMilestonePaymentSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true
  },
  architectDesigner: {
    type: String,
    default: ''
  },
  milestones: {
    type: [milestoneSchema],
    validate: [arr => arr.length <= 5, 'Maximum 5 milestones per project']
  },
  notes: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('ProjectMilestonePayment', projectMilestonePaymentSchema);
