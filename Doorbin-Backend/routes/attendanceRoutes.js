const express = require('express');
const router = express.Router();
const {
  clockIn,
  clockOut,
  getTodayAttendance,
  getAverageAttendance,
  editAttendance
} = require('../controllers/attendanceController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/clock-in', protect, clockIn);
router.post('/clock-out', protect, clockOut);
router.get('/today', protect, getTodayAttendance);
router.get('/average', protect, getAverageAttendance);
router.put('/:id', protect, editAttendance);

module.exports = router;
