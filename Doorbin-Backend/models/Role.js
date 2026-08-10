const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  permissions: {
    userManagement:       { type: Boolean, default: false },
    departmentManagement: { type: Boolean, default: false },
    projectManagement:    { type: Boolean, default: false },
    taskManagement:       { type: Boolean, default: false },
    financeAccess:        { type: Boolean, default: false },
    hrAccess:             { type: Boolean, default: false },
    businessDevAccess:    { type: Boolean, default: false },
    reportsAccess:        { type: Boolean, default: false },
    dashboardAccess:      { type: Boolean, default: true },
    resourceAllocation:   { type: Boolean, default: false },
    calendarAccess:       { type: Boolean, default: true },
    timelineAccess:       { type: Boolean, default: false },
    deleteProjects:       { type: Boolean, default: false },
    systemConfiguration:  { type: Boolean, default: false }
  }
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
