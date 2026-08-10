const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: { type: String },
  head: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  parentDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  employees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

// Pre-save hook: prevent a department from being its own parent
departmentSchema.pre('save', function (next) {
  if (this.parentDepartment && this.parentDepartment.equals(this._id)) {
    return next(new Error('A department cannot be its own parent.'));
  }
  next();
});

module.exports = mongoose.model('Department', departmentSchema);
