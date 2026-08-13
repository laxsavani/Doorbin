const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  type:        { type: String, enum: ['Call', 'Email', 'Meeting', 'Note'], required: true },
  description: { type: String, required: true },
  date:        { type: Date, default: Date.now },
  followUpDate:{ type: Date },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attachments: [{ type: String }]
}, { _id: true });

const statusHistorySchema = new mongoose.Schema({
  status:    { type: String, required: true },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: true });

const enquirySchema = new mongoose.Schema({
  clientName:        { type: String, required: true, trim: true },
  architectName:     { type: String, trim: true },
  projectName:       { type: String, required: true, trim: true },
  projectType:       { type: String, enum: ['Architecture', 'Interior Design', 'Animation'], required: true },
  estimatedValue:    { type: Number, min: 0 },
  source:            { type: String, trim: true },
  assignedExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  followUpDate:       { type: Date },
  priority:           { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  clientCategory:     { type: String, enum: ['Aspirational', 'Regulation', 'Red Flag'] },
  leadTemperature:    { type: String, enum: ['Hot', 'Warm', 'Cold'], default: 'Warm' },
  notes:              { type: String },

  status: {
    type: String,
    enum: ['New Enquiry', 'Qualification', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Project Creation'],
    default: 'New Enquiry'
  },
  statusHistory:     [statusHistorySchema],
  lostReason:        { type: String, trim: true },

  existingClient:    { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  convertedProject:  { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },

  activityLog:       [activityLogSchema],
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

enquirySchema.index({ projectName: 'text', clientName: 'text', architectName: 'text' });
enquirySchema.index({ status: 1, followUpDate: 1 });
enquirySchema.index({ assignedExecutive: 1, status: 1 });
enquirySchema.index({ followUpDate: 1 });

module.exports = mongoose.model('Enquiry', enquirySchema);
