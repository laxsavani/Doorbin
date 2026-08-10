const mongoose = require('mongoose');

const financeCounterSchema = new mongoose.Schema({
  fy:   { type: String, required: true },
  type: { type: String, enum: ['Quotation', 'Invoice'], required: true },
  seq:  { type: Number, default: 0 }
}, { timestamps: true });

financeCounterSchema.index({ fy: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('FinanceCounter', financeCounterSchema);
