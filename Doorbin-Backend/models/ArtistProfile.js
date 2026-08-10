const mongoose = require('mongoose');

const artistProfileSchema = new mongoose.Schema({
  user:               { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  dailyCapacityHours: { type: Number, default: 8, min: 1, max: 24 },
  skillTags:          [{ type: String, trim: true }],
  notes:              { type: String, trim: true }
}, { timestamps: true });

artistProfileSchema.index({ skillTags: 1 });

module.exports = mongoose.model('ArtistProfile', artistProfileSchema);
