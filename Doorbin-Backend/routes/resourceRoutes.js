const express = require('express');
const router = express.Router();
const {
  upsertArtistProfile,
  getArtistProfile,
  deleteArtistProfile,
  getAvailability,
  getArtistAllocation,
  getConflicts,
  getUtilization,
  getForecast
} = require('../controllers/resourceController');
const { protect } = require('../middlewares/authMiddleware');

const resourceAllocationAccess = (req, res, next) => {
  const p = req.user?.role?.permissions;
  const roleName = req.user?.role?.name;
  if (p?.resourceAllocation || p?.projectManagement || p?.userManagement || roleName === 'Director' || roleName === 'Human Resource') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Resource Allocation, Project Management, Director, or HR permission required.' });
};

const directorOrHRAccess = (req, res, next) => {
  const roleName = req.user?.role?.name;
  if (roleName === 'Director' || roleName === 'Human Resource') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Director or Human Resource role required.' });
};

/**
 * @swagger
 * tags:
 *   name: Resource Allocation & Availability
 *   description: Artist Profiles, Skill Tagging, Daily Capacity Tracking, Over-Allocation Conflicts, Utilization Analytics & Forecast Planning APIs
 */

/**
 * @swagger
 * /resources/artist-profile/{userId}:
 *   post:
 *     summary: Set or update Artist Profile, daily capacity hours, and skill tags (Director / HR only)
 *     tags: [Resource Allocation & Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               dailyCapacityHours:
 *                 type: number
 *                 default: 8
 *                 example: 8
 *               skillTags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["3D Modeling", "Texturing", "Lighting"]
 *               notes:
 *                 type: string
 *                 example: Senior 3D artist specializing in luxury villa interior renders.
 *     responses:
 *       200:
 *         description: Artist profile updated successfully
 *       403:
 *         description: Director or HR role required
 */
router.post('/artist-profile/:userId', protect, directorOrHRAccess, upsertArtistProfile);

/**
 * @swagger
 * /resources/artist-profile/{userId}:
 *   get:
 *     summary: Get Artist Profile details including capacity and skill tags
 *     tags: [Resource Allocation & Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Artist profile details or baseline defaults if unconfigured
 */
router.get('/artist-profile/:userId', protect, resourceAllocationAccess, getArtistProfile);

/**
 * @swagger
 * /resources/artist-profile/{userId}:
 *   delete:
 *     summary: Reset/Delete Artist Profile to default baseline (Director / HR only)
 *     tags: [Resource Allocation & Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Artist profile reset to default baseline
 *       403:
 *         description: Director or HR role required
 */
router.delete('/artist-profile/:userId', protect, directorOrHRAccess, deleteArtistProfile);

/**
 * @swagger
 * /resources/availability:
 *   get:
 *     summary: Get Artist Availability & Daily Workload Schedule (Skill filtered)
 *     tags: [Resource Allocation & Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: skill
 *         schema:
 *           type: string
 *           example: Texturing
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Daily schedule & capacity breakdown per artist across window
 *       400:
 *         description: Date range query exceeds maximum 90-day limit
 */
router.get('/availability', protect, resourceAllocationAccess, getAvailability);

/**
 * @swagger
 * /resources/conflicts:
 *   get:
 *     summary: Get Over-Allocation & Leave Conflict Alerts
 *     tags: [Resource Allocation & Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [minor, severe]
 *     responses:
 *       200:
 *         description: List of over-allocation conflict alerts grouped by date and artist
 */
router.get('/conflicts', protect, resourceAllocationAccess, getConflicts);

/**
 * @swagger
 * /resources/utilization:
 *   get:
 *     summary: Get Resource Utilization Percentage Analytics
 *     tags: [Resource Allocation & Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: artist
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Per-artist utilization percentage and studio-wide average
 */
router.get('/utilization', protect, resourceAllocationAccess, getUtilization);

/**
 * @swagger
 * /resources/forecast:
 *   get:
 *     summary: Get Forecast Allocation Demand for Upcoming Projects
 *     tags: [Resource Allocation & Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Projected skill demand for upcoming unstarted projects
 */
router.get('/forecast', protect, resourceAllocationAccess, getForecast);

/**
 * @swagger
 * /resources/{artistId}/allocation:
 *   get:
 *     summary: Get Detailed Task Allocation Breakdown for a specific Artist
 *     tags: [Resource Allocation & Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: artistId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Detailed task-by-task allocation profile
 */
router.get('/:artistId/allocation', protect, resourceAllocationAccess, getArtistAllocation);

module.exports = router;
