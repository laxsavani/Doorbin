const mongoose = require('mongoose');

const subStageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  groupLabel: { type: String }, // e.g. "Living Room" or "Scene 1 / Shot 1"
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Under Review', 'Completed', 'Approved'],
    default: 'Pending'
  },
  completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
  order: { type: Number, required: true },
  dependencies: [{ type: mongoose.Schema.Types.ObjectId }]
}, { _id: true });

const stageSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  stageName: { type: String, required: true },
  order: { type: Number, required: true },
  dependsOn: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stage' }],
  approvalRequired: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  subStages: [subStageSchema],
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Completed'],
    default: 'Not Started'
  },
  completionPercentage: { type: Number, default: 0, min: 0, max: 100 }
}, { timestamps: true });

module.exports = mongoose.model('Stage', stageSchema);
