const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markNotificationRead,
  deleteNotification
} = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Notifications & System Activity
 *   description: Real-time User Notifications & Activity Audit Logs
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get notifications for logged-in user
 *     tags: [Notifications & System Activity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications and unread count
 */
router.get('/', protect, getNotifications);

/**
 * @swagger
 * /notifications/mark-read:
 *   post:
 *     summary: Mark notification(s) as read
 *     tags: [Notifications & System Activity]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notificationId:
 *                 type: string
 *                 description: Specific notification ID or 'all' to mark all read
 *     responses:
 *       200:
 *         description: Notification(s) marked as read
 */
router.post('/mark-read', protect, markNotificationRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications & System Activity]
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
 *         description: Notification deleted
 */
router.delete('/:id', protect, deleteNotification);

module.exports = router;
