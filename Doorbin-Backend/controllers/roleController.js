const Role = require('../models/Role');
const User = require('../models/User');
const logActivity = require('../utils/activityLogger');

const SYSTEM_ROLES = ['Director', 'Production Manager', 'Artist', 'Human Resource', 'Business Development Manager'];

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private (Authenticated users)
const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({}).sort({ createdAt: 1 });
    return res.json(roles);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get single role by ID
// @route   GET /api/roles/:id
// @access  Private (Authenticated users)
const getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    return res.json(role);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Create a custom role
// @route   POST /api/roles
// @access  Private (Director / userManagement)
const createRole = async (req, res) => {
  const { name, description, permissions } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Role name is required' });
  }

  try {
    const existing = await Role.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Role with this name already exists' });
    }

    const role = await Role.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      permissions: permissions || {}
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ROLE_CREATED',
      targetType: 'Role',
      targetId: role._id,
      metadata: { roleName: role.name }
    });

    return res.status(201).json(role);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update permissions or metadata for a role
// @route   PUT /api/roles/:id
// @access  Private (Director / userManagement)
const updateRolePermissions = async (req, res) => {
  const { name, description, permissions } = req.body;

  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    if (name && name.trim() && name.trim() !== role.name) {
      if (SYSTEM_ROLES.includes(role.name)) {
        return res.status(400).json({ message: `Cannot rename built-in system role '${role.name}'` });
      }
      role.name = name.trim();
    }

    if (description !== undefined) role.description = description.trim();

    if (permissions && typeof permissions === 'object') {
      role.permissions = {
        ...role.permissions.toObject(),
        ...permissions
      };
    }

    const updatedRole = await role.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ROLE_UPDATED',
      targetType: 'Role',
      targetId: role._id,
      metadata: { roleName: role.name, updatedPermissions: permissions }
    });

    return res.json(updatedRole);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete custom role
// @route   DELETE /api/roles/:id
// @access  Private (Director / userManagement)
const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    if (SYSTEM_ROLES.includes(role.name)) {
      return res.status(400).json({ message: `Cannot delete built-in system role '${role.name}'` });
    }

    const usersWithRole = await User.countDocuments({ role: role._id });
    if (usersWithRole > 0) {
      return res.status(400).json({ message: `Cannot delete role '${role.name}' because ${usersWithRole} user(s) are assigned to it` });
    }

    await Role.findByIdAndDelete(role._id);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ROLE_DELETED',
      targetType: 'Role',
      targetId: role._id,
      metadata: { roleName: role.name }
    });

    return res.json({ message: `Role '${role.name}' deleted successfully` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getRoles,
  getRoleById,
  createRole,
  updateRolePermissions,
  deleteRole
};
