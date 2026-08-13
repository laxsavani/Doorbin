const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
  updateUser,
  resetUserPassword
} = require('../controllers/userController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

const userOrHrAccess = (req, res, next) => {
  if (req.user?.role?.permissions?.userManagement || req.user?.role?.permissions?.hrAccess) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
};

/**
 * @swagger
 * tags:
 *   name: User Management
 *   description: User Management & Role Assignment APIs
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users with filters
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by Role ObjectId
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by Department ObjectId
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Active, Inactive]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Array of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
router.get('/', protect, userOrHrAccess, getUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user details by ID
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ObjectId
 *     responses:
 *       200:
 *         description: User object
 *       403:
 *         description: Access denied (Can only view own details unless Director/HR)
 *       404:
 *         description: User not found
 */
router.get('/:id', protect, getUserById);

/**
 * @swagger
 * /users/{id}/status:
 *   put:
 *     summary: Update user status (Activate/Deactivate)
 *     tags: [User Management]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Active, Inactive]
 *                 example: Inactive
 *     responses:
 *       200:
 *         description: User status updated
 *       400:
 *         description: Cannot deactivate the last active Director
 *       403:
 *         description: Director permission required
 */
router.put('/:id/status', protect, checkPermission('userManagement'), updateUserStatus);

/**
 * @swagger
 * /users/{id}/role:
 *   put:
 *     summary: Reassign user role
 *     tags: [User Management]
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
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 description: ObjectId of new Role
 *     responses:
 *       200:
 *         description: Role reassigned successfully
 *       403:
 *         description: Director permission required
 */
router.put('/:id/role', protect, checkPermission('userManagement'), updateUserRole);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update full user details (name, email, phone, role, department, status, password)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User updated
 *       403:
 *         description: Access denied
 */
router.put('/:id', protect, checkPermission('userManagement'), updateUser);
router.put('/:id/reset-password', protect, checkPermission('userManagement'), resetUserPassword);

module.exports = router;
