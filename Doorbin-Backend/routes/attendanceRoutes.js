const express = require('express');
const router = express.Router();
const {
  clockIn,
  clockOut,
  getTodayAttendance
} = require('../controllers/attendanceController');
const { protect } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Attendance Module
 *   description: Single-entry employee Clock-In, Clock-Out & Average Working Hours Calculation
 */

/**
 * @swagger
 * /attendance/clock-in:
 *   post:
 *     summary: Clock in employee attendance session
 *     tags: [Attendance Module]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully clocked in
 *       400:
 *         description: Already clocked in
 */
router.post('/clock-in', protect, clockIn);

/**
 * @swagger
 * /attendance/clock-out:
 *   post:
 *     summary: Clock out employee attendance session
 *     tags: [Attendance Module]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully clocked out and updated working hours & average working time
 *       400:
 *         description: No active clock-in session found or already clocked out
 */
router.post('/clock-out', protect, clockOut);

/**
 * @swagger
 * /attendance/today:
 *   get:
 *     summary: Get active attendance session for logged-in user today
 *     tags: [Attendance Module]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active attendance session, status, working hours & average working time
 */
router.get('/today', protect, getTodayAttendance);

module.exports = router;
