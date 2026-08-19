const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:                 { type: String, required: true },
  email:                { type: String, required: true, unique: true, lowercase: true },
  password:             { type: String, required: true },
  role:                 { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  secondaryRole:        { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  department:           { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  phone:                { type: String },
  status:               { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  profileImage:         { type: String },
  joiningDate:          { type: Date },
  exitDate:             { type: Date },
  exitReason:           { type: String },
  documents:            [{ name: String, url: String, uploadedAt: { type: Date, default: Date.now } }],
  lastLogin:            { type: Date },
  passwordResetToken:   { type: String },
  passwordResetExpires: { type: Date }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
