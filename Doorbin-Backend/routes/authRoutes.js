const express = require('express');
const { check } = require('express-validator');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User Authentication & Profile Management APIs
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@doorbin.com
 *               password:
 *                 type: string
 *                 example: Password123
 *               role:
 *                 type: string
 *                 description: ObjectId of the Role
 *                 example: 66b0a1f8e91d2c34567890ab
 *               department:
 *                 type: string
 *                 description: ObjectId of Department (optional)
 *               phone:
 *                 type: string
 *                 example: "+91 9876543210"
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or user already exists
 */
router.post(
  '/register',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be 6 or more characters').isLength({ min: 6 })
  ],
  registerUser
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User Login
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: director@doorbin.com
 *               password:
 *                 type: string
 *                 example: DirectorPassword123
 *     responses:
 *       200:
 *         description: Login successful, returns user details and JWT token
 *       401:
 *         description: Invalid credentials or account inactive
 */
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
  ],
  loginUser
);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile details
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', protect, getUserProfile);
router.get('/me', protect, getUserProfile);

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               profileImage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', protect, updateUserProfile);

/**
 * @swagger
 * /auth/change-password:
 *   put:
 *     summary: Change own password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       401:
 *         description: Incorrect current password or unauthorized
 */
router.put(
  '/change-password',
  protect,
  [
    check('currentPassword', 'Current password is required').exists(),
    check('newPassword', 'New password must be 6 or more characters').isLength({ min: 6 })
  ],
  changePassword
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: artist@doorbin.com
 *     responses:
 *       200:
 *         description: Reset token generated
 *       404:
 *         description: Email not found
 */
router.post(
  '/forgot-password',
  [check('email', 'Please include a valid email').isEmail()],
  forgotPassword
);

/**
 * @swagger
 * /auth/reset-password/{token}:
 *   put:
 *     summary: Reset password using token
 *     tags: [Authentication]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 example: NewSecret123
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
router.put(
  '/reset-password/:token',
  [check('newPassword', 'New password must be 6 or more characters').isLength({ min: 6 })],
  resetPassword
);

module.exports = router;
