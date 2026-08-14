const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Role = require('../models/Role');
const logActivity = require('../utils/activityLogger');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Private (Director / userManagement permission)
const registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, role, department, phone } = req.body;

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    let roleObj;
    if (role && mongoose.Types.ObjectId.isValid(role)) {
      roleObj = await Role.findById(role);
    }
    if (!roleObj && role && typeof role === 'string') {
      roleObj = await Role.findOne({ name: new RegExp(`^${role}$`, 'i') });
    }
    if (!roleObj) {
      const roleCount = await Role.countDocuments();
      if (roleCount === 0) {
        const seedRoles = require('../utils/seedRoles');
        await seedRoles();
      }
      if (role && typeof role === 'string' && role.length < 30) {
        roleObj = await Role.findOne({ name: new RegExp(`^${role}$`, 'i') });
      }
      if (!roleObj) {
        roleObj = await Role.findOne({ name: 'Director' });
      }
    }

    if (!roleObj) {
      return res.status(400).json({ message: 'Role resolution failed. Please ensure roles are seeded.' });
    }

    const validDepartment = (department && mongoose.Types.ObjectId.isValid(department)) ? department : null;

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: roleObj._id,
      department: validDepartment,
      phone
    });

    const populatedUser = await User.findById(user._id)
      .select('-password')
      .populate('role department');

    await logActivity({
      req,
      userId: req.user ? req.user._id : user._id,
      action: 'USER_CREATED',
      targetType: 'User',
      targetId: user._id,
      metadata: { createdEmail: user.email, roleName: roleObj.name }
    });

    return res.status(201).json({
      message: 'User registered successfully',
      user: populatedUser
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const failedLoginTracker = new Map();

// @desc    Login user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  const userEmail = (email || '').toLowerCase().trim();
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'client';
  const trackKey = `${userEmail}_${clientIp}`;
  const now = Date.now();

  const trackData = failedLoginTracker.get(trackKey) || { attempts: 0, lockoutUntil: 0 };

  if (trackData.lockoutUntil && trackData.lockoutUntil > now) {
    const diffMs = trackData.lockoutUntil - now;
    const mins = Math.ceil(diffMs / (60 * 1000));
    return res.status(429).json({
      message: `Account is temporarily blocked due to 5 failed login attempts. Please try again in ${mins} minute(s).`,
      lockoutUntil: trackData.lockoutUntil
    });
  }

  try {
    const user = await User.findOne({ email: userEmail }).populate('role department');

    if (!user) {
      trackData.attempts += 1;
      if (trackData.attempts >= 5) {
        trackData.lockoutUntil = now + 15 * 60 * 1000;
        failedLoginTracker.set(trackKey, trackData);
        return res.status(429).json({
          message: '5 consecutive failed login attempts! Your account access is temporarily blocked for 15 minutes.',
          lockoutUntil: trackData.lockoutUntil
        });
      }
      failedLoginTracker.set(trackKey, trackData);
      const remaining = 5 - trackData.attempts;
      return res.status(401).json({ message: `Invalid email or password. (${remaining} attempt${remaining > 1 ? 's' : ''} remaining before 15-min lockout)` });
    }

    if (user.status !== 'Active') {
      return res.status(401).json({ message: 'Account is inactive. Please contact system administrator.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      trackData.attempts += 1;
      if (trackData.attempts >= 5) {
        trackData.lockoutUntil = now + 15 * 60 * 1000;
        failedLoginTracker.set(trackKey, trackData);
        return res.status(429).json({
          message: '5 consecutive failed login attempts! Your account access is temporarily blocked for 15 minutes.',
          lockoutUntil: trackData.lockoutUntil
        });
      }
      failedLoginTracker.set(trackKey, trackData);
      const remaining = 5 - trackData.attempts;
      return res.status(401).json({ message: `Invalid email or password. (${remaining} attempt${remaining > 1 ? 's' : ''} remaining before 15-min lockout)` });
    }

    // Reset failed attempts on success
    failedLoginTracker.delete(trackKey);

    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    await logActivity({
      req,
      userId: user._id,
      action: 'LOGIN',
      targetType: 'User',
      targetId: user._id,
      metadata: { email: user.email }
    });

    const token = generateToken(user._id);
    const userResponse = user.toObject();
    delete userResponse.password;

    return res.json({
      user: userResponse,
      token
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  return res.json(req.user);
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.phone = req.body.phone !== undefined ? req.body.phone : user.phone;
      user.profileImage = req.body.profileImage !== undefined ? req.body.profileImage : user.profileImage;

      const updatedUser = await user.save();
      const populatedUser = await User.findById(updatedUser._id)
        .select('-password')
        .populate('role department');

      return res.json(populatedUser);
    } else {
      return res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user._id);

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    await logActivity({
      req,
      userId: user._id,
      action: 'PASSWORD_CHANGED',
      targetType: 'User',
      targetId: user._id
    });

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Request password reset token
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email: email ? email.toLowerCase() : '' });
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    user.passwordResetToken = resetPasswordToken;
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save({ validateBeforeSave: false });

    return res.json({
      message: 'Password reset token generated successfully',
      resetToken
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Reset password using token
// @route   PUT /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { newPassword } = req.body;
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  try {
    const user = await User.findOne({
      passwordResetToken: resetPasswordToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset token' });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    await logActivity({
      req,
      userId: user._id,
      action: 'PASSWORD_RESET',
      targetType: 'User',
      targetId: user._id
    });

    return res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  forgotPassword,
  resetPassword
};
