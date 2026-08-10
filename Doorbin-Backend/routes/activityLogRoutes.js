const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activityLogController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Audit Trail (Activity Logs)
 *   description: System Audit & User Activity Trail APIs
 */

/**
 * @swagger
 * /activity-logs:
 *   get:
 *     summary: Fetch paginated audit trail logs
 *     tags: [Audit Trail (Activity Logs)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *         description: Filter by User ObjectId
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action (e.g. LOGIN, USER_CREATED, ROLE_UPDATED, STATUS_CHANGED)
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date ISO string
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date ISO string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated audit logs array
 *       403:
 *         description: Director permission required
 */
router.get('/', protect, checkPermission('userManagement'), getActivityLogs);

module.exports = router;
