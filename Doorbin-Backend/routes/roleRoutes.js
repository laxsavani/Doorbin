const express = require('express');
const router = express.Router();
const {
  getRoles,
  getRoleById,
  createRole,
  updateRolePermissions,
  deleteRole
} = require('../controllers/roleController');
const { protect } = require('../middlewares/authMiddleware');

const userManagementAccess = (req, res, next) => {
  const p = req.user?.role?.permissions;
  const roleName = req.user?.role?.name;
  if (p?.userManagement || roleName === 'Director') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Director or User Management permission required.' });
};

/**
 * @swagger
 * tags:
 *   name: Role Management
 *   description: System Roles & Granular RBAC Permissions Management
 */

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: List all system roles
 *     tags: [Role Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles and permission flags
 *   post:
 *     summary: Create a custom role (Director / Admin)
 *     tags: [Role Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Quality Auditor
 *               description:
 *                 type: string
 *                 example: Custom role for auditing render output quality
 *               permissions:
 *                 type: object
 *     responses:
 *       201:
 *         description: Role created successfully
 */
router.route('/')
  .get(protect, getRoles)
  .post(protect, userManagementAccess, createRole);

/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     summary: Get role details by ID
 *     tags: [Role Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role details
 *   put:
 *     summary: Update role permissions or metadata
 *     tags: [Role Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               permissions:
 *                 type: object
 *     responses:
 *       200:
 *         description: Role updated successfully
 *   delete:
 *     summary: Delete custom role (Built-in roles protected)
 *     tags: [Role Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted successfully
 */
router.route('/:id')
  .get(protect, getRoleById)
  .put(protect, userManagementAccess, updateRolePermissions)
  .delete(protect, userManagementAccess, deleteRole);

module.exports = router;
