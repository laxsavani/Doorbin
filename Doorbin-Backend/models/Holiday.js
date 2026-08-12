const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  date: { type: Date, required: true, unique: true },
  type: { type: String, default: 'Festival' },
  category: { type: String, default: 'Festival' }
}, { timestamps: true });

module.exports = mongoose.model('Holiday', holidaySchema);
