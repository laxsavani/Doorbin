const express = require('express');
const router = express.Router();
const {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  uploadEmployeeDocument,
  getEmployeeDocuments,
  markAttendance,
  clockIn,
  clockOut,
  getTodayAttendance,
  getAttendanceByEmployee,
  exportAttendance,
  applyLeave,
  getLeaves,
  approveLeave,
  createHoliday,
  getHolidays,
  deleteHoliday,
  createPerformanceReview,
  getPerformanceReviews,
  getAttendanceReport,
  getLeaveReport,
  getPerformanceReport,
  getDepartmentStrengthReport,
  getResourceUtilizationReport,
  getJoiningExitReport
} = require('../controllers/hrController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

const hrAccess = checkPermission('hrAccess');

/**
 * @swagger
 * tags:
 *   name: Human Resource Management (HRM)
 *   description: Employee Master, Attendance, Leave Management, Holidays, Documents, Performance Reviews & HR Reports
 */

// --- EMPLOYEE MASTER ---
/**
 * @swagger
 * /hr/employees:
 *   get:
 *     summary: List all employee profiles
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, exited, all]
 *     responses:
 *       200:
 *         description: List of employees
 *   post:
 *     summary: Onboard new employee master record for existing user
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - employeeCode
 *               - dateOfJoining
 *             properties:
 *               userId:
 *                 type: string
 *               employeeCode:
 *                 type: string
 *                 example: "DV-EMP-001"
 *               designation:
 *                 type: string
 *                 example: "Senior 3D Artist"
 *               dateOfJoining:
 *                 type: string
 *                 example: "01/01/2026"
 *               emergencyContact:
 *                 type: string
 *                 example: "+91 9876543210"
 *     responses:
 *       201:
 *         description: Employee onboarded
 */
router.route('/employees')
  .get(protect, hrAccess, getEmployees)
  .post(protect, hrAccess, createEmployee);

/**
 * @swagger
 * /hr/employees/{id}:
 *   get:
 *     summary: Get single employee profile (HR or Self)
 *     tags: [Human Resource Management (HRM)]
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
 *         description: Employee profile details
 *   put:
 *     summary: Update employee profile or set dateOfExit
 *     tags: [Human Resource Management (HRM)]
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
 *         description: Employee updated
 */
router.route('/employees/:id')
  .get(protect, getEmployeeById)
  .put(protect, hrAccess, updateEmployee);

// --- EMPLOYEE DOCUMENTS ---
/**
 * @swagger
 * /hr/employees/{id}/documents:
 *   get:
 *     summary: Get employee documents list (HR or Self)
 *     tags: [Human Resource Management (HRM)]
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
 *         description: Employee documents
 *   post:
 *     summary: Upload employee document (HR only)
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Document uploaded
 */
router.route('/employees/:id/documents')
  .get(protect, getEmployeeDocuments)
  .post(protect, hrAccess, uploadEmployeeDocument);

// --- ATTENDANCE ---
/**
 * @swagger
 * /hr/attendance:
 *   post:
 *     summary: Mark daily attendance (Self-marking or HR for others)
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               employee:
 *                 type: string
 *                 description: User ID (defaults to self if omitted)
 *               date:
 *                 type: string
 *                 example: "10/08/2026"
 *               status:
 *                 type: string
 *                 enum: [Present, Absent, Half-day, On Leave]
 *               checkIn:
 *                 type: string
 *               checkOut:
 *                 type: string
 *     responses:
 *       201:
 *         description: Attendance marked
 */
router.post('/attendance', protect, markAttendance);
router.post('/attendance/clock-in', protect, clockIn);
router.post('/attendance/clock-out', protect, clockOut);
router.get('/attendance/today', protect, getTodayAttendance);
router.get('/attendance/export', protect, exportAttendance);

/**
 * @swagger
 * /hr/attendance/{employeeId}:
 *   get:
 *     summary: Get attendance history for employee (HR or Self)
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
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
 *         description: Attendance history
 */
router.get('/attendance/:employeeId', protect, getAttendanceByEmployee);

// --- LEAVE MANAGEMENT ---
/**
 * @swagger
 * /hr/leave:
 *   get:
 *     summary: Get leave applications (HR sees all, employees see own)
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of leave applications
 *   post:
 *     summary: Apply for leave (Self service)
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - leaveType
 *               - fromDate
 *               - toDate
 *             properties:
 *               leaveType:
 *                 type: string
 *                 example: "Casual"
 *               fromDate:
 *                 type: string
 *                 example: "15/08/2026"
 *               toDate:
 *                 type: string
 *                 example: "17/08/2026"
 *               reason:
 *                 type: string
 *                 example: "Personal family event"
 *     responses:
 *       201:
 *         description: Leave application submitted
 */
router.route('/leave')
  .get(protect, getLeaves)
  .post(protect, applyLeave);

router.route('/leaves')
  .get(protect, getLeaves)
  .post(protect, applyLeave);

/**
 * @swagger
 * /hr/leave/{id}/approve:
 *   put:
 *     summary: Approve or reject leave application (Auto-creates 'On Leave' attendance records)
 *     tags: [Human Resource Management (HRM)]
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
 *               - decision
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [Approved, Rejected]
 *     responses:
 *       200:
 *         description: Leave decision recorded
 */
router.put('/leave/:id/approve', protect, hrAccess, approveLeave);
router.patch('/leave/:id/approve', protect, hrAccess, approveLeave);
router.put('/leaves/:id/approve', protect, hrAccess, approveLeave);
router.patch('/leaves/:id/approve', protect, hrAccess, approveLeave);

// --- HOLIDAYS ---
/**
 * @swagger
 * /hr/holidays:
 *   get:
 *     summary: Get studio holiday calendar (Open to all staff)
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of holidays
 *   post:
 *     summary: Add holiday date (HR only)
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - date
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Independence Day"
 *               date:
 *                 type: string
 *                 example: "15/08/2026"
 *     responses:
 *       201:
 *         description: Holiday created
 */
router.route('/holidays')
  .get(protect, getHolidays)
  .post(protect, hrAccess, createHoliday);

/**
 * @swagger
 * /hr/holidays/{id}:
 *   delete:
 *     summary: Delete holiday date (HR only)
 *     tags: [Human Resource Management (HRM)]
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
 *         description: Holiday deleted
 */
router.delete('/holidays/:id', protect, hrAccess, deleteHoliday);

// --- PERFORMANCE REVIEWS ---
/**
 * @swagger
 * /hr/performance-reviews:
 *   get:
 *     summary: Get performance reviews (HR sees all, employees see own)
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of performance reviews
 *   post:
 *     summary: Create performance review (HR only)
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - employee
 *               - reviewPeriod
 *             properties:
 *               employee:
 *                 type: string
 *               reviewPeriod:
 *                 type: string
 *                 example: "Q3 2026"
 *               rating:
 *                 type: number
 *                 example: 4.5
 *               strengths:
 *                 type: string
 *               areasForImprovement:
 *                 type: string
 *               comments:
 *                 type: string
 *     responses:
 *       201:
 *         description: Performance review created
 */
router.route('/performance-reviews')
  .get(protect, getPerformanceReviews)
  .post(protect, hrAccess, createPerformanceReview);

// --- HR REPORTS ---
/**
 * @swagger
 * /hr/reports/attendance:
 *   get:
 *     summary: HR Report - Attendance summary
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Attendance report
 */
router.get('/reports/attendance', protect, hrAccess, getAttendanceReport);

/**
 * @swagger
 * /hr/reports/leave:
 *   get:
 *     summary: HR Report - Leave applications report
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Leave report
 */
router.get('/reports/leave', protect, hrAccess, getLeaveReport);

/**
 * @swagger
 * /hr/reports/employee-performance:
 *   get:
 *     summary: HR Report - Aggregated Employee Performance report
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance report
 */
router.get('/reports/employee-performance', protect, hrAccess, getPerformanceReport);

/**
 * @swagger
 * /hr/reports/department-strength:
 *   get:
 *     summary: HR Report - Department Strength breakdown (Delegates to Module 2)
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department strength report
 */
router.get('/reports/department-strength', protect, hrAccess, getDepartmentStrengthReport);

/**
 * @swagger
 * /hr/reports/resource-utilization:
 *   get:
 *     summary: HR Report - Resource Utilization breakdown (Delegates to Module 8)
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resource utilization report
 */
router.get('/reports/resource-utilization', protect, hrAccess, getResourceUtilizationReport);

/**
 * @swagger
 * /hr/reports/joining-exit:
 *   get:
 *     summary: HR Report - Joining & Exit Report for date range
 *     tags: [Human Resource Management (HRM)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Joining and exit report
 */
router.get('/reports/joining-exit', protect, hrAccess, getJoiningExitReport);

module.exports = router;
