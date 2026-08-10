const mongoose = require('mongoose');

const financeSettingsSchema = new mongoose.Schema({
  defaultGstRate: { type: Number, default: 18, min: 0, max: 100 },
  quotationNumberFormat: { type: String, default: 'DV/Q/{FY}/{SEQ}' },
  invoiceNumberFormat:   { type: String, default: 'DV/INV/{FY}/{SEQ}' },
  assumedHourlyCostRate: { type: Number, default: 500, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model('FinanceSettings', financeSettingsSchema);
