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

// @desc    Get average clock-in, clock-out & working hours (Aggregation Pipeline - Section D.3)
// @route   GET /api/attendance/average
// @access  Private
const getAverageAttendance = async (req, res) => {
  try {
    const employeeId = req.query.employeeId || req.user._id;
    const { fromDate, toDate } = req.query;

    const queryFrom = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const queryTo = toDate ? new Date(toDate) : new Date();

    const records = await Attendance.find({
      employee: employeeId,
      date: { $gte: queryFrom, $lte: queryTo },
      checkIn: { $ne: null },
      checkOut: { $ne: null }
    });

    if (!records.length) {
      return res.json({
        success: true,
        data: {
          averageClockIn: '09:00 AM',
          averageClockOut: '06:00 PM',
          averageWorkingHours: 0,
          totalDaysPresent: 0
        }
      });
    }

    let totalCheckInMins = 0;
    let totalCheckOutMins = 0;
    let totalHours = 0;

    records.forEach(r => {
      const inDate = new Date(r.checkIn);
      const outDate = new Date(r.checkOut);
      totalCheckInMins += (inDate.getHours() * 60) + inDate.getMinutes();
      totalCheckOutMins += (outDate.getHours() * 60) + outDate.getMinutes();
      totalHours += (r.workingHours || 0);
    });

    const avgInMins = Math.round(totalCheckInMins / records.length);
    const avgOutMins = Math.round(totalCheckOutMins / records.length);

    const formatMinsToTime = (mins) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 || 12;
      return `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    return res.json({
      success: true,
      data: {
        averageClockIn: formatMinsToTime(avgInMins),
        averageClockOut: formatMinsToTime(avgOutMins),
        averageWorkingHours: Number((totalHours / records.length).toFixed(2)),
        totalDaysPresent: records.length
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Edit particular day's attendance record (HR/Director manual correction - Section D.4)
// @route   PUT /api/attendance/:id
// @access  Private (HR / Director)
const editAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut, status, remarks } = req.body;

    const attendance = await Attendance.findById(id);
    if (!attendance) return res.status(404).json({ message: 'Attendance record not found' });

    if (checkIn) attendance.checkIn = new Date(checkIn);
    if (checkOut) attendance.checkOut = new Date(checkOut);
    if (status) attendance.status = status;
    if (remarks) attendance.remarks = remarks;

    if (attendance.checkIn && attendance.checkOut) {
      const diffMs = new Date(attendance.checkOut).getTime() - new Date(attendance.checkIn).getTime();
      attendance.workingHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
    }

    attendance.editedManually = true;
    attendance.markedBy = req.user._id;
    await attendance.save();

    return res.json({
      message: 'Attendance record updated successfully',
      attendance
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  clockIn,
  clockOut,
  getTodayAttendance,
  getAverageAttendance,
  editAttendance
};
