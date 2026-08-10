const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  invoice:         { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  client:          { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  amountPaid:      { type: Number, required: true, min: 0.01 },
  paymentDate:     { type: Date, required: true, default: Date.now },
  paymentMode:     { type: String, enum: ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Other'], required: true },
  referenceNumber: { type: String, trim: true },
  receivedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes:           { type: String, trim: true }
}, { timestamps: true });

paymentSchema.index({ invoice: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ paymentDate: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
