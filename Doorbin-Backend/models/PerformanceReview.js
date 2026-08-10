const mongoose = require('mongoose');

const performanceReviewSchema = new mongoose.Schema({
  employee:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewPeriod:        { type: String, required: true, trim: true },
  reviewedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating:              { type: Number, min: 1, max: 5 },
  strengths:           { type: String, trim: true },
  areasForImprovement: { type: String, trim: true },
  comments:            { type: String, trim: true }
}, { timestamps: true });

performanceReviewSchema.index({ employee: 1 });

module.exports = mongoose.model('PerformanceReview', performanceReviewSchema);
