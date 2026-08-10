const express = require('express');
const router = express.Router();
const {
  getProjectGanttChart,
  getCriticalPath,
  getPlannedVsActual,
  rescheduleTask,
  getRescheduleHistory,
  getStudioCalendar
} = require('../controllers/timelineController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

const pmOrDirectorAccess = (req, res, next) => {
  const p = req.user?.role?.permissions;
  if (p?.projectManagement || p?.userManagement) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Project Management or Director permission required.' });
};

/**
 * @swagger
 * tags:
 *   name: Timeline & Studio Calendar
 *   description: Gantt Chart Data Assembly, CPM Critical Path, Planned vs Actual Variance, Drag-and-Drop Rescheduling & Studio-Wide Calendar APIs
 */

/**
 * @swagger
 * /timeline/project/{id}:
 *   get:
 *     summary: Get interactive Gantt Chart data assembly for a project
 *     tags: [Timeline & Studio Calendar]
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
 *         description: Full Gantt tree (Project -> Stages -> Tasks) with derived dates & milestones
 *       404:
 *         description: Project not found
 */
router.get('/timeline/project/:id', protect, getProjectGanttChart);

/**
 * @swagger
 * /timeline/critical-path/{projectId}:
 *   get:
 *     summary: Calculate Critical Path Method (CPM) for project tasks
 *     tags: [Timeline & Studio Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Critical path task sequence and minimum project duration days
 *       400:
 *         description: Circular dependency detected
 *       403:
 *         description: PM or Director permission required
 */
router.get('/timeline/critical-path/:projectId', protect, pmOrDirectorAccess, getCriticalPath);

/**
 * @swagger
 * /timeline/planned-vs-actual/{projectId}:
 *   get:
 *     summary: Get Planned vs Actual Duration Comparison Report
 *     tags: [Timeline & Studio Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Per-stage and project-level planned vs actual days and variance
 *       403:
 *         description: PM or Director permission required
 */
router.get('/timeline/planned-vs-actual/:projectId', protect, pmOrDirectorAccess, getPlannedVsActual);

/**
 * @swagger
 * /timeline/task/{id}/reschedule:
 *   put:
 *     summary: Drag-and-Drop Reschedule task dates with recursive dependent cascade
 *     tags: [Timeline & Studio Calendar]
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
 *               - startDate
 *               - endDate
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               cascade:
 *                 type: boolean
 *                 default: false
 *                 description: If true, recursively shifts downstream dependent tasks by date delta
 *               reason:
 *                 type: string
 *                 example: Client delayed floorplan approval by 3 days
 *     responses:
 *       200:
 *         description: Task rescheduled and cascaded tasks / conflicts returned
 *       403:
 *         description: PM or Director permission required
 */
router.put('/timeline/task/:id/reschedule', protect, pmOrDirectorAccess, rescheduleTask);

/**
 * @swagger
 * /timeline/reschedule-history/{projectId}:
 *   get:
 *     summary: Get Reschedule History audit logs for a project
 *     tags: [Timeline & Studio Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of RescheduleLog entries for project
 *       403:
 *         description: PM or Director permission required
 */
router.get('/timeline/reschedule-history/:projectId', protect, pmOrDirectorAccess, getRescheduleHistory);

/**
 * @swagger
 * /calendar:
 *   get:
 *     summary: Get Studio-Wide Calendar (Monthly, Weekly, Daily Views)
 *     tags: [Timeline & Studio Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: view
 *         schema:
 *           type: string
 *           enum: [month, week, day]
 *           default: month
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           example: 2026-08-01
 *     responses:
 *       200:
 *         description: Studio-wide aggregated task schedule for window
 */
router.get('/calendar', protect, getStudioCalendar);

module.exports = router;
