const express = require('express');
const router = express.Router();
const {
  getProjectReports,
  getEmployeeReports,
  getFinanceReports,
  getProductivityReports,
  exportReport,
  createScheduledReport,
  getScheduledReports,
  updateScheduledReport,
  deleteScheduledReport
} = require('../controllers/reportController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

const reportsAccess = (req, res, next) => {
  const roleName = req.user?.role?.name;
  const p = req.user?.role?.permissions;
  if (roleName === 'Director' || roleName === 'Production Manager' || roleName === 'HR' || roleName === 'Project Manager' || p?.reportsAccess || p?.projectManagement || p?.financeAccess || p?.userManagement) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Reports permission required.' });
};
const financeAccess = checkPermission('financeAccess');

/**
 * @swagger
 * tags:
 *   name: Reporting & Analytics
 *   description: Deep-Dive Filterable Reports, Centralized Streaming Export Engine & Automated Scheduled Report Delivery APIs
 */

// --- PROJECT REPORTS ---
/**
 * @swagger
 * /reports/projects:
 *   get:
 *     summary: Get Project Reports with advanced filters
 *     tags: [Reporting & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [active, delayed, completed, stage-wise-progress, timeline-variance, client-wise]
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *       - in: query
 *         name: projectCategory
 *         schema:
 *           type: string
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Filtered Project report dataset
 */
router.get('/projects', protect, reportsAccess, getProjectReports);

// --- EMPLOYEE REPORTS ---
/**
 * @swagger
 * /reports/employees:
 *   get:
 *     summary: Get Employee Reports with blended performance ranking
 *     tags: [Reporting & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [productivity, assigned-vs-completed, utilization, attendance, performance-ranking]
 *       - in: query
 *         name: employee
 *         schema:
 *           type: string
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Filtered Employee report dataset
 */
router.get('/employees', protect, reportsAccess, getEmployeeReports);

// --- FINANCE REPORTS (DOUBLE-GATED) ---
/**
 * @swagger
 * /reports/finance:
 *   get:
 *     summary: Get Finance Reports (Double-Gated - reportsAccess AND financeAccess)
 *     tags: [Reporting & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [receivables, revenue, profitability, outstanding-dues, cashflow, wip]
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Filtered Finance report dataset
 *       403:
 *         description: Access denied. Finance permission required.
 */
router.get('/finance', protect, reportsAccess, financeAccess, getFinanceReports);

// --- PRODUCTIVITY REPORTS ---
/**
 * @swagger
 * /reports/productivity:
 *   get:
 *     summary: Get Productivity Reports with delay analysis
 *     tags: [Reporting & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [artist-efficiency, department-performance, avg-completion-time, delay-analysis, resource-utilization]
 *       - in: query
 *         name: employee
 *         schema:
 *           type: string
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Filtered Productivity report dataset
 */
router.get('/productivity', protect, reportsAccess, getProductivityReports);

// --- UNIFIED EXPORT ENGINE ---
/**
 * @swagger
 * /reports/export:
 *   get:
 *     summary: Stream Excel (.xlsx) or PDF (.pdf) file download for any report category
 *     tags: [Reporting & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [projects, employees, finance, productivity]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [excel, pdf]
 *     responses:
 *       200:
 *         description: Binary file stream (Content-Disposition attachment)
 */
router.get('/export', protect, reportsAccess, exportReport);

// --- SCHEDULED REPORTS ---
/**
 * @swagger
 * /reports/scheduled:
 *   get:
 *     summary: List scheduled report configurations
 *     tags: [Reporting & Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduled report configurations list
 *   post:
 *     summary: Create new scheduled report configuration
 *     tags: [Reporting & Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportType
 *               - frequency
 *             properties:
 *               reportType:
 *                 type: string
 *                 example: "delayed"
 *               category:
 *                 type: string
 *                 enum: [projects, employees, finance, productivity]
 *                 example: "projects"
 *               frequency:
 *                 type: string
 *                 enum: [Daily, Weekly, Monthly]
 *                 example: "Weekly"
 *               format:
 *                 type: string
 *                 enum: [excel, pdf]
 *                 example: "excel"
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["director@doorbin.com"]
 *     responses:
 *       201:
 *         description: Scheduled report created
 */
router.route('/scheduled')
  .get(protect, reportsAccess, getScheduledReports)
  .post(protect, reportsAccess, createScheduledReport);

/**
 * @swagger
 * /reports/scheduled/{id}:
 *   put:
 *     summary: Update scheduled report configuration
 *     tags: [Reporting & Analytics]
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
 *         description: Scheduled report updated
 *   delete:
 *     summary: Delete scheduled report configuration
 *     tags: [Reporting & Analytics]
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
 *         description: Scheduled report deleted
 */
router.route('/scheduled/:id')
  .put(protect, reportsAccess, updateScheduledReport)
  .delete(protect, reportsAccess, deleteScheduledReport);

module.exports = router;
