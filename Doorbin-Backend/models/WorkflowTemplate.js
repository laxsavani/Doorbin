const mongoose = require('mongoose');

const templateSubStageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  order: { type: Number, required: true },
  isRepeatableGroup: { type: Boolean, default: false },
  checklist: [{ type: String }]
}, { _id: true });

const templateStageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  order: { type: Number, required: true },
  approvalRequired: { type: Boolean, default: false },
  subStages: [templateSubStageSchema]
}, { _id: true });

const workflowTemplateSchema = new mongoose.Schema({
  projectCategory: {
    type: String,
    enum: ['Architecture', 'Interior Design', 'Animation'],
    required: true,
    unique: true
  },
  stages: [templateStageSchema]
}, { timestamps: true });

module.exports = mongoose.model('WorkflowTemplate', workflowTemplateSchema);
