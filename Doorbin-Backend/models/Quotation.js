const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
  client:          { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  project:         { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  quotationNumber: { type: String, required: true, unique: true, trim: true },
  amount:          { type: Number, required: true, min: 0 },
  date:            { type: Date, default: Date.now },
  validTill:       { type: Date },
  status:          { type: String, enum: ['Draft', 'Sent', 'Accepted', 'Rejected'], default: 'Draft' },
  notes:           { type: String, trim: true },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

quotationSchema.index({ client: 1 });
quotationSchema.index({ project: 1 });

module.exports = mongoose.model('Quotation', quotationSchema);
