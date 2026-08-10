const express = require('express');
const router = express.Router();
const {
  getDirectorDashboard,
  getPMDashboard,
  getArtistDashboard,
  getHRDashboard,
  getBDDashboard,
  getDashboardSummary
} = require('../controllers/dashboardController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

const dashboardAccess = checkPermission('dashboardAccess');

/**
 * @swagger
 * tags:
 *   name: Dashboards
 *   description: Role-Specific Curated Dashboards & Auto-Routing Summary APIs
 */

/**
 * @swagger
 * /dashboard/summary:
 *   get:
 *     summary: Auto-detect caller role and return matched dashboard
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role-matched dashboard data
 */
router.get('/summary', protect, dashboardAccess, getDashboardSummary);

/**
 * @swagger
 * /dashboard/director:
 *   get:
 *     summary: Director Dashboard (Studio-wide projects, revenue, outstanding, pipeline, utilization, trends)
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Studio-wide Director dashboard profile
 *       403:
 *         description: Access denied. Director role required.
 */
router.get('/director', protect, dashboardAccess, getDirectorDashboard);

/**
 * @swagger
 * /dashboard/production-manager:
 *   get:
 *     summary: Production Manager Dashboard (Scoped to visible projects, stage progress, team workload, deadlines)
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PM dashboard profile
 *       403:
 *         description: Access denied. PM or Director role required.
 */
router.get('/production-manager', protect, dashboardAccess, getPMDashboard);

/**
 * @swagger
 * /dashboard/artist:
 *   get:
 *     summary: Artist Dashboard (Strictly self-scoped tasks, today's work, pending reviews, deadlines, productivity)
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personal Artist dashboard profile
 */
router.get('/artist', protect, dashboardAccess, getArtistDashboard);

/**
 * @swagger
 * /dashboard/hr:
 *   get:
 *     summary: HR Dashboard (Attendance, pending leaves, department strength, performance reviews)
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: HR dashboard profile
 *       403:
 *         description: Access denied. HR or Director role required.
 */
router.get('/hr', protect, dashboardAccess, getHRDashboard);

/**
 * @swagger
 * /dashboard/bd:
 *   get:
 *     summary: Business Development Dashboard (Enquiries, meetings, follow-ups, conversion rate, forecast)
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business Development dashboard profile
 *       403:
 *         description: Access denied. BD Manager or Director role required.
 */
router.get('/bd', protect, dashboardAccess, getBDDashboard);

module.exports = router;
