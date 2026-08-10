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

module.exports = {
  getUsers,
  getUserById,
  updateUserStatus,
  updateUserRole
};
