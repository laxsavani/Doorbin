const mongoose = require('mongoose');

const documentEntrySchema = new mongoose.Schema({
  type:       { type: String, required: true, trim: true },
  fileUrl:    { type: String, required: true, trim: true },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

const employeeSchema = new mongoose.Schema({
  user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  employeeCode:     { type: String, required: true, unique: true, trim: true },
  designation:      { type: String, trim: true },
  dateOfJoining:    { type: Date, required: true },
  dateOfExit:       { type: Date, default: null },
  emergencyContact: { type: String, trim: true },
  documents:        [documentEntrySchema]
}, { timestamps: true });

employeeSchema.index({ designation: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
