const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  designation: { type: String },
  email:       { type: String },
  phone:       { type: String }
}, { _id: true });

const communicationLogSchema = new mongoose.Schema({
  type:        { type: String, enum: ['Call', 'Email', 'Meeting', 'Note'], required: true },
  description: { type: String, required: true },
  date:        { type: Date, default: Date.now },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { _id: true });

const clientSchema = new mongoose.Schema({
  companyName: { type: String, required: true, trim: true },
  clientName:  { type: String, required: true },   // primary contact name
  email:       { type: String, required: true },   // primary contact email
  phone:       { type: String, required: true },   // primary contact phone
  address:     { type: String },
  gstDetails:  { type: String },
  industry:    { type: String },
  defaultProjectType: { type: String },
  originEnquiry:      { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry' },
  contacts:    [contactSchema],                     // additional contacts
  notes:       { type: String },
  communicationLog: [communicationLogSchema],
  status:      { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

clientSchema.index({ companyName: 'text', clientName: 'text', email: 'text' });

module.exports = mongoose.model('Client', clientSchema);
