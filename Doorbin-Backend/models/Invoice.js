const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  client:        { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  project:       { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  quotation:     { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },
  invoiceNumber: { type: String, required: true, unique: true, trim: true },
  amount:        { type: Number, required: true, min: 0 },
  gstRate:       { type: Number, default: 18, min: 0 },
  gst:           { type: Number, required: true, min: 0 },
  totalAmount:   { type: Number, required: true, min: 0 },
  issueDate:     { type: Date, required: true },
  dueDate:       { type: Date, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Overdue', 'Partially Paid'],
    default: 'Pending'
  },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

invoiceSchema.index({ client: 1 });
invoiceSchema.index({ project: 1 });
invoiceSchema.index({ status: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
