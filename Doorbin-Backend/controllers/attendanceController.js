const Attendance = require('../models/Attendance');
const logActivity = require('../utils/activityLogger');
const { formatDDMMYYYY } = require('../utils/dateFormatter');

// Helper to compute average working hours for an employee
const calculateAverageWorkingHours = async (employeeId) => {
  const records = await Attendance.find({
    employee: employeeId,
    checkOut: { $ne: null },
    workingHours: { $gt: 0 }
  });

  if (records.length === 0) return 0;
  const total = records.reduce((sum, r) => sum + (r.workingHours || 0), 0);
  return Number((total / records.length).toFixed(2));
};

// @desc    Clock in employee attendance session for today (creates or updates single entry)
// @route   POST /api/attendance/clock-in
// @access  Private (Authenticated User)
const clockIn = async (req, res) => {
  const userId = req.user._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    let attendance = await Attendance.findOne({
      employee: userId,
      date: today
    });

    if (attendance && attendance.checkIn && !attendance.checkOut) {
      return res.status(400).json({
        message: 'You are already clocked in today. Please clock out before starting a new session.',
        attendance,
        isClockedIn: true
      });
    }

    const now = new Date();

    if (attendance) {
      attendance.checkIn = now;
      attendance.checkOut = null;
      attendance.workingHours = 0;
      attendance.status = 'Present';
      attendance.markedBy = userId;
      await attendance.save();
    } else {
      attendance = await Attendance.create({
        employee: userId,
        date: today,
        status: 'Present',
        checkIn: now,
        markedBy: userId
      });
    }

    await logActivity({
      req,
      userId,
      action: 'ATTENDANCE_CLOCK_IN',
      targetType: 'Attendance',
      targetId: attendance._id,
      metadata: { checkIn: now }
    });

    const avgHours = await calculateAverageWorkingHours(userId);

    return res.json({
      message: 'Clocked in successfully',
      attendance: {
        ...attendance.toObject(),
        dateFormatted: formatDDMMYYYY(attendance.date),
        checkInFormatted: attendance.checkIn ? attendance.checkIn.toLocaleTimeString() : null
      },
      isClockedIn: true,
      averageWorkingHours: avgHours
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Clock out employee attendance session for today (updates same entry, calculates worked & avg time)
// @route   POST /api/attendance/clock-out
// @access  Private (Authenticated User)
const clockOut = async (req, res) => {
  const userId = req.user._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const attendance = await Attendance.findOne({
      employee: userId,
      date: today
    });

    if (!attendance || !attendance.checkIn) {
      return res.status(400).json({
        message: 'No active clock-in session found for today. Please clock in first.'
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        message: 'You have already clocked out for today.',
        attendance,
        isClockedIn: false
      });
    }

    const now = new Date();
    attendance.checkOut = now;

    // Calculate worked duration in hours
    const diffMs = now.getTime() - new Date(attendance.checkIn).getTime();
    const workedHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
    attendance.workingHours = workedHours;

    // Update status based on hours worked
    if (workedHours < 4) {
      attendance.status = 'Half-day';
    } else {
      attendance.status = 'Present';
    }

    await attendance.save();

    await logActivity({
      req,
      userId,
      action: 'ATTENDANCE_CLOCK_OUT',
      targetType: 'Attendance',
      targetId: attendance._id,
      metadata: { checkOut: now, workingHours: workedHours }
    });

    const avgHours = await calculateAverageWorkingHours(userId);

    return res.json({
      message: 'Clocked out successfully',
      attendance: {
        ...attendance.toObject(),
        dateFormatted: formatDDMMYYYY(attendance.date),
        checkInFormatted: attendance.checkIn ? attendance.checkIn.toLocaleTimeString() : null,
        checkOutFormatted: attendance.checkOut.toLocaleTimeString()
      },
      workingHours: workedHours,
      averageWorkingHours: avgHours,
      isClockedIn: false
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get active attendance session and stats for logged-in user today
// @route   GET /api/attendance/today
// @access  Private (Authenticated User)
const getTodayAttendance = async (req, res) => {
  const userId = req.user._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const attendance = await Attendance.findOne({
      employee: userId,
      date: today
    }).populate('markedBy', 'name email');

    const isClockedIn = !!(attendance && attendance.checkIn && !attendance.checkOut);

    let currentSessionHours = 0;
    if (isClockedIn) {
      const diffMs = new Date().getTime() - new Date(attendance.checkIn).getTime();
      currentSessionHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
    }

    const avgHours = await calculateAverageWorkingHours(userId);

    return res.json({
      activeSession: attendance ? {
        ...attendance.toObject(),
        dateFormatted: formatDDMMYYYY(attendance.date),
        checkInFormatted: attendance.checkIn ? attendance.checkIn.toLocaleTimeString() : null,
        checkOutFormatted: attendance.checkOut ? attendance.checkOut.toLocaleTimeString() : null
      } : null,
      isClockedIn,
      workingHours: attendance ? (attendance.workingHours || currentSessionHours) : 0,
      currentSessionHours,
      averageWorkingHours: avgHours
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  clockIn,
  clockOut,
  getTodayAttendance
};
