const mongoose = require('mongoose');

const scheduledReportSchema = new mongoose.Schema({
  reportType: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['projects', 'employees', 'finance', 'productivity'],
    default: 'projects'
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  frequency: {
    type: String,
    enum: ['Daily', 'Weekly', 'Monthly'],
    required: true
  },
  format: {
    type: String,
    enum: ['excel', 'pdf'],
    default: 'excel'
  },
  recipients: [{
    type: String,
    trim: true
  }],
  recipientUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastSentAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('ScheduledReport', scheduledReportSchema);
