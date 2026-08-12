const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const logActivity = require('../utils/activityLogger');
const { formatDDMMYYYY } = require('../utils/dateFormatter');
const { calculateWorkingHours, checkLateArrival, checkEarlyLeave } = require('../utils/attendanceCalc');
const { exportToExcel, exportToPDF, exportToCSV } = require('../services/exportEngine');

// Helper to check if date is Sunday or Holiday
const isTodaySundayOrHoliday = async (dateObj = new Date()) => {
  if (dateObj.getDay() === 0) {
    return { isBlocked: true, name: 'Sunday (Weekly Off)' };
  }
  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateObj);
  endOfDay.setHours(23, 59, 59, 999);

  const holiday = await Holiday.findOne({
    date: { $gte: startOfDay, $lte: endOfDay }
  });

  if (holiday) {
    return { isBlocked: true, name: holiday.name };
  }
  return { isBlocked: false };
};

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

// @desc    Clock in employee attendance session for today
// @route   POST /api/attendance/clock-in
// @access  Private (Authenticated User)
const clockIn = async (req, res) => {
  const userId = req.user._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const holCheck = await isTodaySundayOrHoliday(today);
    if (holCheck.isBlocked) {
      return res.status(400).json({
        success: false,
        message: `Clock-in is disabled today (${holCheck.name}). Enjoy your day off!`,
        isHoliday: true,
        holidayName: holCheck.name
      });
    }
    let attendance = await Attendance.findOne({
      employee: userId,
      date: today
    });

    if (attendance && (attendance.checkIn || attendance.clockIn) && !(attendance.checkOut || attendance.clockOut)) {
      return res.status(400).json({
        success: false,
        message: 'You are already clocked in today. Please clock out before starting a new session.',
        attendance,
        isClockedIn: true
      });
    }

    const now = new Date();
    const isLate = checkLateArrival(now);

    if (attendance) {
      attendance.checkIn = now;
      attendance.clockIn = now;
      attendance.checkOut = null;
      attendance.clockOut = null;
      attendance.workingHours = 0;
      attendance.status = 'Present';
      attendance.isLate = isLate;
      attendance.markedBy = userId;
      await attendance.save();
    } else {
      attendance = await Attendance.create({
        employee: userId,
        date: today,
        status: 'Present',
        checkIn: now,
        clockIn: now,
        isLate,
        markedBy: userId
      });
    }

    await logActivity({
      req,
      userId,
      action: 'ATTENDANCE_CLOCK_IN',
      targetType: 'Attendance',
      targetId: attendance._id,
      metadata: { checkIn: now, isLate }
    });

    const avgHours = await calculateAverageWorkingHours(userId);

    const resData = {
      employee: userId,
      date: attendance.date,
      clockIn: attendance.checkIn || attendance.clockIn,
      checkIn: attendance.checkIn || attendance.clockIn,
      isLate: attendance.isLate,
      status: attendance.status,
      dateFormatted: formatDDMMYYYY(attendance.date),
      checkInFormatted: attendance.checkIn ? attendance.checkIn.toLocaleTimeString() : null
    };

    return res.json({
      success: true,
      message: 'Clocked in successfully',
      attendance: resData,
      data: resData,
      isClockedIn: true,
      averageWorkingHours: avgHours
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clock out employee attendance session for today
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

    const checkInTime = attendance ? (attendance.checkIn || attendance.clockIn) : null;
    if (!attendance || !checkInTime) {
      return res.status(400).json({
        success: false,
        message: 'No active clock-in session found for today. Please clock in first.'
      });
    }

    if (attendance.checkOut || attendance.clockOut) {
      return res.status(400).json({
        success: false,
        message: 'You have already clocked out for today.',
        attendance,
        isClockedIn: false
      });
    }

    const now = new Date();
    attendance.checkOut = now;
    attendance.clockOut = now;

    const workedHours = calculateWorkingHours(checkInTime, now);
    attendance.workingHours = workedHours;

    const isEarly = checkEarlyLeave(now);
    attendance.isEarlyLeave = isEarly;

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
      metadata: { checkOut: now, workingHours: workedHours, isEarlyLeave: isEarly }
    });

    const avgHours = await calculateAverageWorkingHours(userId);

    const resData = {
      clockIn: checkInTime,
      checkIn: checkInTime,
      clockOut: now,
      checkOut: now,
      workingHours: workedHours,
      isEarlyLeave: isEarly,
      status: attendance.status
    };

    return res.json({
      success: true,
      message: 'Clocked out successfully',
      attendance: {
        ...attendance.toObject(),
        dateFormatted: formatDDMMYYYY(attendance.date),
        checkInFormatted: checkInTime ? new Date(checkInTime).toLocaleTimeString() : null,
        checkOutFormatted: now.toLocaleTimeString()
      },
      data: resData,
      workingHours: workedHours,
      averageWorkingHours: avgHours,
      isClockedIn: false
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
    const holCheck = await isTodaySundayOrHoliday(today);
    if (holCheck.isBlocked) {
      return res.json({
        success: true,
        activeSession: null,
        isClockedIn: false,
        isHoliday: true,
        holidayName: holCheck.name,
        status: 'Holiday',
        workingHours: 0,
        averageWorkingHours: await calculateAverageWorkingHours(userId)
      });
    }

    const attendance = await Attendance.findOne({
      employee: userId,
      date: today
    }).populate('markedBy', 'name email');

    const checkInTime = attendance ? (attendance.checkIn || attendance.clockIn) : null;
    const checkOutTime = attendance ? (attendance.checkOut || attendance.clockOut) : null;

    const isClockedIn = !!(attendance && checkInTime && !checkOutTime);

    let currentSessionHours = 0;
    if (isClockedIn) {
      currentSessionHours = calculateWorkingHours(checkInTime, new Date());
    }

    const avgHours = await calculateAverageWorkingHours(userId);

    return res.json({
      success: true,
      activeSession: attendance ? {
        ...attendance.toObject(),
        dateFormatted: formatDDMMYYYY(attendance.date),
        checkInFormatted: checkInTime ? new Date(checkInTime).toLocaleTimeString() : null,
        checkOutFormatted: checkOutTime ? new Date(checkOutTime).toLocaleTimeString() : null
      } : null,
      isClockedIn,
      workingHours: attendance ? (attendance.workingHours || currentSessionHours) : 0,
      currentSessionHours,
      averageWorkingHours: avgHours
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get average clock-in, clock-out & working hours
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
      $or: [{ checkIn: { $ne: null } }, { clockIn: { $ne: null } }],
      $or: [{ checkOut: { $ne: null } }, { clockOut: { $ne: null } }]
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
      const inDate = new Date(r.checkIn || r.clockIn);
      const outDate = new Date(r.checkOut || r.clockOut);
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
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Edit particular day's attendance record (HR/Director manual correction)
// @route   PUT /api/attendance/:id
// @access  Private (HR / Director)
const editAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { checkIn, clockIn: cIn, checkOut, clockOut: cOut, status, remarks } = req.body;

    const attendance = await Attendance.findById(id);
    if (!attendance) return res.status(404).json({ success: false, message: 'Attendance record not found' });

    const newIn = checkIn || cIn;
    const newOut = checkOut || cOut;

    if (newIn) {
      attendance.checkIn = new Date(newIn);
      attendance.clockIn = new Date(newIn);
      attendance.isLate = checkLateArrival(newIn);
    }
    if (newOut) {
      attendance.checkOut = new Date(newOut);
      attendance.clockOut = new Date(newOut);
      attendance.isEarlyLeave = checkEarlyLeave(newOut);
    }
    if (status) attendance.status = status;
    if (remarks !== undefined) attendance.remarks = remarks;

    const inTime = attendance.checkIn || attendance.clockIn;
    const outTime = attendance.checkOut || attendance.clockOut;

    if (inTime && outTime) {
      attendance.workingHours = calculateWorkingHours(inTime, outTime);
    }

    attendance.editedManually = true;
    attendance.markedBy = req.user._id;
    await attendance.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ATTENDANCE_EDITED_MANUALLY',
      targetType: 'Attendance',
      targetId: attendance._id,
      metadata: { employee: attendance.employee, date: attendance.date, status: attendance.status }
    });

    return res.json({
      success: true,
      message: 'Attendance record updated successfully',
      data: attendance,
      attendance
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all attendance records with filtering
// @route   GET /api/attendance
// @access  Private
const getAllAttendance = async (req, res) => {
  try {
    const { employeeId, date, fromDate, toDate, status } = req.query;
    const query = {};

    if (employeeId) query.employee = employeeId;
    if (status) query.status = new RegExp(status, 'i');

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      query.date = d;
    } else if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    const records = await Attendance.find(query)
      .populate('employee', 'name email department designation')
      .populate('markedBy', 'name email')
      .sort({ date: -1 });

    return res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get specific employee attendance history
// @route   GET /api/attendance/:employeeId
// @access  Private
const getEmployeeAttendance = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    const query = { employee: employeeId };

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: start, $lte: end };
    }

    const records = await Attendance.find(query).sort({ date: -1 });
    const avgHours = await calculateAverageWorkingHours(employeeId);

    return res.json({
      success: true,
      employeeId,
      averageWorkingHours: avgHours,
      count: records.length,
      data: records
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get attendance summary for employee
// @route   GET /api/attendance/summary/:employeeId
// @access  Private
const getAttendanceSummary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    const y = year ? parseInt(year, 10) : new Date().getFullYear();

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    const records = await Attendance.find({
      employee: employeeId,
      date: { $gte: start, $lte: end }
    });

    let present = 0, absent = 0, halfDay = 0, leave = 0, holiday = 0, totalHours = 0;
    records.forEach(r => {
      const st = r.status ? r.status.toLowerCase() : '';
      if (st.includes('present')) present++;
      else if (st.includes('absent')) absent++;
      else if (st.includes('half')) halfDay++;
      else if (st.includes('leave')) leave++;
      else if (st.includes('holiday')) holiday++;
      totalHours += (r.workingHours || 0);
    });

    const avgHours = await calculateAverageWorkingHours(employeeId);

    return res.json({
      success: true,
      data: {
        employeeId,
        month: m,
        year: y,
        counts: { present, absent, halfDay, leave, holiday },
        totalHoursWorked: Number(totalHours.toFixed(2)),
        averageWorkingHours: avgHours
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get team attendance summary grid
// @route   GET /api/attendance/team-summary
// @access  Private
const getTeamSummary = async (req, res) => {
  try {
    const { date, department } = req.query;
    const queryDate = date ? new Date(date) : new Date();
    queryDate.setHours(0, 0, 0, 0);

    const userQuery = { status: 'Active' };
    if (department) userQuery.department = department;

    const users = await User.find(userQuery).populate('department', 'name');
    const userIds = users.map(u => u._id);

    const attendanceRecords = await Attendance.find({
      employee: { $in: userIds },
      date: queryDate
    });

    const attMap = new Map();
    attendanceRecords.forEach(a => attMap.set(a.employee.toString(), a));

    const grid = users.map(u => {
      const att = attMap.get(u._id.toString());
      return {
        user: { _id: u._id, name: u.name, email: u.email, department: u.department },
        status: att ? att.status : 'Absent',
        checkIn: att ? (att.checkIn || att.clockIn) : null,
        checkOut: att ? (att.checkOut || att.clockOut) : null,
        workingHours: att ? att.workingHours : 0,
        isLate: att ? att.isLate : false,
        isEarlyLeave: att ? att.isEarlyLeave : false
      };
    });

    return res.json({
      success: true,
      date: queryDate,
      totalUsers: users.length,
      presentCount: grid.filter(g => g.status.toLowerCase().includes('present')).length,
      absentCount: grid.filter(g => g.status.toLowerCase().includes('absent')).length,
      data: grid
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export attendance records
// @route   GET /api/attendance/export
// @access  Private (HR / Director)
const exportAttendance = async (req, res) => {
  try {
    const { type = 'excel', fromDate, toDate } = req.query;
    const query = {};
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    const records = await Attendance.find(query).populate('employee', 'name email department').sort({ date: -1 });

    const exportData = records.map(r => ({
      Employee: r.employee ? r.employee.name : 'N/A',
      Date: formatDDMMYYYY(r.date),
      Status: r.status,
      ClockIn: (r.checkIn || r.clockIn) ? new Date(r.checkIn || r.clockIn).toLocaleTimeString() : 'N/A',
      ClockOut: (r.checkOut || r.clockOut) ? new Date(r.checkOut || r.clockOut).toLocaleTimeString() : 'N/A',
      WorkingHours: r.workingHours || 0,
      IsLate: r.isLate ? 'Yes' : 'No',
      IsEarlyLeave: r.isEarlyLeave ? 'Yes' : 'No'
    }));

    if (type.toLowerCase() === 'pdf') {
      return await exportToPDF(res, 'Attendance_Report', exportData);
    } else if (type.toLowerCase() === 'csv') {
      return await exportToCSV(res, 'Attendance_Report', exportData);
    } else {
      return await exportToExcel(res, 'Attendance_Report', exportData);
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};
