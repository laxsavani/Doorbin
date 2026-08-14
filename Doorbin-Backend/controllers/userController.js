const User = require('../models/User');
const Role = require('../models/Role');
const logActivity = require('../utils/activityLogger');

// @desc    Get list of all users
// @route   GET /api/users
// @access  Private (Director / HR - userManagement or hrAccess)
const getUsers = async (req, res) => {
  try {
    const { role, department, status } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (department) filter.department = department;
    if (status) filter.status = status;

    const users = await User.find(filter)
      .select('-password')
      .populate('role department')
      .sort({ createdAt: -1 });

    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Director, HR, or self)
const getUserById = async (req, res) => {
  try {
    const isSelf = req.user._id.toString() === req.params.id;
    const hasUserMgmt = req.user?.role?.permissions?.userManagement;
    const hasHrAccess = req.user?.role?.permissions?.hrAccess;

    if (!isSelf && !hasUserMgmt && !hasHrAccess) {
      return res.status(403).json({ message: 'Access denied. You can only view your own account details.' });
    }

    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('role department');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update user status (Active / Inactive)
// @route   PUT /api/users/:id/status
// @access  Private (Director only - userManagement)
const updateUserStatus = async (req, res) => {
  const { status } = req.body;

  if (!['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({ message: 'Status must be Active or Inactive' });
  }

  try {
    const user = await User.findById(req.params.id).populate('role');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Safety guard: prevent deactivating the last active Director
    if (user.role && user.role.name === 'Director' && status === 'Inactive') {
      const directorRole = await Role.findOne({ name: 'Director' });
      const activeDirectorsCount = await User.countDocuments({
        role: directorRole._id,
        status: 'Active'
      });

      if (activeDirectorsCount <= 1) {
        return res.status(400).json({
          message: 'Action blocked: Cannot deactivate the last active Director in the system.'
        });
      }
    }

    const oldStatus = user.status;
    user.status = status;
    await user.save({ validateBeforeSave: false });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'STATUS_CHANGED',
      targetType: 'User',
      targetId: user._id,
      metadata: { previousStatus: oldStatus, newStatus: status, email: user.email }
    });

    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate('role department');

    return res.json(updatedUser);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Reassign user role
// @route   PUT /api/users/:id/role
// @access  Private (Director only - userManagement)
const updateUserRole = async (req, res) => {
  const { role } = req.body;

  try {
    const roleObj = await Role.findById(role);
    if (!roleObj) {
      return res.status(400).json({ message: 'Invalid role ID' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const oldRoleId = user.role;
    user.role = role;
    await user.save({ validateBeforeSave: false });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ROLE_ASSIGNED',
      targetType: 'User',
      targetId: user._id,
      metadata: { previousRoleId: oldRoleId, newRoleId: role, newRoleName: roleObj.name }
    });

    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate('role department');

    return res.json(updatedUser);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update full user account details
// @route   PUT /api/users/:id
// @access  Private (Director / HR - userManagement)
const updateUser = async (req, res) => {
  const { name, email, phone, role, department, status, password } = req.body;

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (role) user.role = role;
    if (department) user.department = department;
    if (status && ['Active', 'Inactive'].includes(status)) user.status = status;
    if (password && password.trim().length >= 6) {
      user.password = password;
    }

    await user.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'USER_UPDATED',
      targetType: 'User',
      targetId: user._id,
      metadata: { name: user.name, email: user.email, role: user.role, status: user.status }
    });

    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate('role department');

    return res.json(updatedUser);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Admin Reset User Password (Director only)
// @route   PUT /api/users/:id/reset-password
// @access  Private (Director - userManagement)
const resetUserPassword = async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword.trim();
    await user.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'PASSWORD_RESET_BY_ADMIN',
      targetType: 'User',
      targetId: user._id,
      metadata: { targetUserEmail: user.email }
    });

    return res.json({ message: `Password for ${user.name} (${user.email}) has been reset successfully.` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Create / register new user
// @route   POST /api/users
// @access  Private (Director / HR - userManagement)
const createUser = async (req, res) => {
  const { name, email, password, role, department, phone, status } = req.body;
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'User already exists with this email address' });
    }

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      department: department || null,
      phone: phone || '',
      status: status || 'Active'
    });

    const populated = await User.findById(newUser._id).select('-password').populate('role department');
    return res.status(201).json({ message: 'User registered successfully', user: populated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUserStatus,
  updateUserRole,
  updateUser,
  resetUserPassword
};
