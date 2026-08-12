const express = require('express');
const router = express.Router();
const {
  clockIn,
  clockOut,
  getTodayAttendance,
  getAverageAttendance,
  editAttendance,
  getAllAttendance,
  getEmployeeAttendance,
  getAttendanceSummary,
  getTeamSummary,
  exportAttendance
} = require('../controllers/attendanceController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/clock-in', protect, clockIn);
router.post('/clock-out', protect, clockOut);
router.get('/today', protect, getTodayAttendance);
router.get('/average', protect, getAverageAttendance);
router.get('/summary/:employeeId', protect, getAttendanceSummary);
router.get('/team-summary', protect, getTeamSummary);
router.get('/export', protect, exportAttendance);
router.get('/', protect, getAllAttendance);
router.get('/:employeeId', protect, getEmployeeAttendance);
router.put('/:id', protect, editAttendance);

module.exports = router;
