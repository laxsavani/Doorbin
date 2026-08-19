const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const LeaveType = require('../models/LeaveType');
const Holiday = require('../models/Holiday');
const PerformanceReview = require('../models/PerformanceReview');
const User = require('../models/User');
const Department = require('../models/Department');
const logActivity = require('../utils/activityLogger');
const { formatDDMMYYYY, parseDateString } = require('../utils/dateFormatter');
const { streamExcel, streamPdf, streamCsv } = require('../services/exportEngine');
const mongoose = require('mongoose');

// Helper: Check if current user is HR or Director
const isHROrDirector = (req) => {
  const roleName = req.user?.role?.name;
  const p = req.user?.role?.permissions;
  return roleName === 'Director' || roleName === 'Human Resource' || p?.hrAccess === true;
};

// ============================================================
// EMPLOYEE MASTER CONTROLLERS
// ============================================================

// @desc    Create Employee Master record for an existing User
// @route   POST /api/hr/employees
// @access  Private (hrAccess permission holder)
const createEmployee = async (req, res) => {
  const { userId, employeeCode, designation, dateOfJoining, emergencyContact } = req.body;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Valid userId is required' });
  }
  if (!employeeCode || !employeeCode.trim()) {
    return res.status(400).json({ message: 'employeeCode is required' });
  }
  if (!dateOfJoining) {
    return res.status(400).json({ message: 'dateOfJoining is required' });
  }

  try {
    const userObj = await User.findById(userId);
    if (!userObj) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const existingEmp = await Employee.findOne({ $or: [{ user: userId }, { employeeCode: employeeCode.trim() }] });
    if (existingEmp) {
      return res.status(400).json({ message: 'Employee record or employeeCode already exists' });
    }

    const doj = parseDateString(dateOfJoining);

    const employee = await Employee.create({
      user: userId,
      employeeCode: employeeCode.trim(),
      designation: designation ? designation.trim() : '',
      dateOfJoining: doj,
      emergencyContact: emergencyContact ? emergencyContact.trim() : '',
      documents: []
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'EMPLOYEE_ONBOARDED',
      targetType: 'Employee',
      targetId: employee._id,
      metadata: { employeeCode: employee.employeeCode, userName: userObj.name }
    });

    const populated = await Employee.findById(employee._id)
      .populate('user', 'name email status role department');

    return res.status(201).json({
      ...populated.toObject(),
      dateOfJoiningFormatted: formatDDMMYYYY(populated.dateOfJoining)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all Employees
// @route   GET /api/hr/employees
// @access  Private (hrAccess permission holder)
const getEmployees = async (req, res) => {
  try {
    const { department, status, page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (!isHROrDirector(req)) query.user = req.user._id;
    if (status === 'active') query.dateOfExit = null;
    else if (status === 'exited') query.dateOfExit = { $ne: null };

    let employees = await Employee.find(query)
      .populate({
        path: 'user',
        select: 'name email status role department',
        populate: [
          { path: 'role', select: 'name' },
          { path: 'department', select: 'name' }
        ]
      })
      .sort({ createdAt: -1 });

    if (department && mongoose.Types.ObjectId.isValid(department)) {
      employees = employees.filter(emp => emp.user?.department?._id?.toString() === department);
    }

    const total = employees.length;
    const paginated = employees.slice(skip, skip + limitNum);

    const formatted = paginated.map(emp => ({
      ...emp.toObject(),
      dateOfJoiningFormatted: formatDDMMYYYY(emp.dateOfJoining),
      dateOfExitFormatted: emp.dateOfExit ? formatDDMMYYYY(emp.dateOfExit) : null
    }));

    return res.json({
      totalCount: total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      employees: formatted
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Employee by ID or User ID
// @route   GET /api/hr/employees/:id
// @access  Private (hrAccess OR Self)
const getEmployeeById = async (req, res) => {
  try {
    const param = req.params.id;
    let employee = null;

    if (mongoose.Types.ObjectId.isValid(param)) {
      employee = await Employee.findById(param)
        .populate({
          path: 'user',
          select: 'name email status role department',
          populate: [
            { path: 'role', select: 'name' },
            { path: 'department', select: 'name' }
          ]
        });

      if (!employee) {
        employee = await Employee.findOne({ user: param })
          .populate({
            path: 'user',
            select: 'name email status role department',
            populate: [
              { path: 'role', select: 'name' },
              { path: 'department', select: 'name' }
            ]
          });
      }
    }

    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    // Ownership check: hrAccess or Self
    const isSelf = req.user._id.toString() === employee.user?._id?.toString();
    if (!isHROrDirector(req) && !isSelf) {
      return res.status(403).json({ message: 'Access denied. You can only view your own employee profile.' });
    }

    return res.json({
      ...employee.toObject(),
      dateOfJoiningFormatted: formatDDMMYYYY(employee.dateOfJoining),
      dateOfExitFormatted: employee.dateOfExit ? formatDDMMYYYY(employee.dateOfExit) : null
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update Employee details or set dateOfExit
// @route   PUT /api/hr/employees/:id
// @access  Private (hrAccess permission holder)
const updateEmployee = async (req, res) => {
  const { designation, emergencyContact, dateOfExit } = req.body;

  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    if (designation !== undefined) employee.designation = String(designation).trim();
    if (emergencyContact !== undefined) employee.emergencyContact = String(emergencyContact).trim();
    if (dateOfExit !== undefined) {
      employee.dateOfExit = dateOfExit ? parseDateString(dateOfExit, true) : null;
    }

    await employee.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'EMPLOYEE_UPDATED',
      targetType: 'Employee',
      targetId: employee._id,
      metadata: { employeeCode: employee.employeeCode }
    });

    const updated = await Employee.findById(employee._id)
      .populate('user', 'name email status role department');

    return res.json({
      ...updated.toObject(),
      dateOfJoiningFormatted: formatDDMMYYYY(updated.dateOfJoining),
      dateOfExitFormatted: updated.dateOfExit ? formatDDMMYYYY(updated.dateOfExit) : null
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// DOCUMENTS CONTROLLERS
// ============================================================

// @desc    Upload Employee Document entry
// @route   POST /api/hr/employees/:id/documents
// @access  Private (hrAccess permission holder)
const uploadEmployeeDocument = async (req, res) => {
  const { type, fileUrl } = req.body;

  if (!type || !type.trim()) {
    return res.status(400).json({ message: 'Document type label is required' });
  }

  const finalFileUrl = req.file ? `/uploads/documents/${req.file.filename}` : fileUrl;
  if (!finalFileUrl) {
    return res.status(400).json({ message: 'Document file or fileUrl is required' });
  }

  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.documents.push({
      type: type.trim(),
      fileUrl: finalFileUrl,
      uploadedAt: new Date()
    });

    await employee.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'EMPLOYEE_DOCUMENT_UPLOADED',
      targetType: 'Employee',
      targetId: employee._id,
      metadata: { docType: type }
    });

    return res.status(201).json(employee.documents);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Employee Documents
// @route   GET /api/hr/employees/:id/documents
// @access  Private (hrAccess OR Self)
const getEmployeeDocuments = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const isSelf = req.user._id.toString() === employee.user.toString();
    if (!isHROrDirector(req) && !isSelf) {
      return res.status(403).json({ message: 'Access denied. You can only view your own documents.' });
    }

    return res.json(employee.documents.map(d => ({
      ...d.toObject(),
      uploadedAtFormatted: formatDDMMYYYY(d.uploadedAt)
    })));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// ATTENDANCE CONTROLLERS
// ============================================================

// @desc    Mark Attendance (Self or HR for others; blocks manual 'On Leave')
// @route   POST /api/hr/attendance
// @access  Private (Authenticated User - Ownership Gated or hrAccess)
const markAttendance = async (req, res) => {
  const { employee, date, status, checkIn, checkOut } = req.body;

  const targetEmployeeId = employee && mongoose.Types.ObjectId.isValid(employee)
    ? employee
    : req.user._id;

  const isSelf = req.user._id.toString() === targetEmployeeId.toString();

  if (!isSelf && !isHROrDirector(req)) {
    return res.status(403).json({ message: 'Access denied. HR permission required to mark attendance for other employees.' });
  }

  if (!status || !['Present', 'Absent', 'Half-day', 'On Leave'].includes(status)) {
    return res.status(400).json({ message: 'Valid attendance status (Present, Absent, Half-day, On Leave) is required' });
  }

  const attDate = date ? parseDateString(date) : new Date();
  attDate.setHours(0, 0, 0, 0);

  try {
    // Safety rail: Block manual submission of 'On Leave' if no approved leave covers that date
    if (status === 'On Leave') {
      const approvedLeave = await Leave.findOne({
        employee: targetEmployeeId,
        status: 'Approved',
        fromDate: { $lte: attDate },
        toDate: { $gte: attDate }
      });

      if (!approvedLeave) {
        return res.status(400).json({ message: "Status 'On Leave' cannot be marked manually without an approved leave application covering this date." });
      }
    }

    const cIn = checkIn ? new Date(checkIn) : (status === 'Present' || status === 'Half-day' ? new Date() : null);
    const cOut = checkOut ? new Date(checkOut) : null;

    const attendance = await Attendance.findOneAndUpdate(
      { employee: targetEmployeeId, date: attDate },
      {
        employee: targetEmployeeId,
        date: attDate,
        status,
        checkIn: cIn,
        checkOut: cOut,
        markedBy: req.user._id
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      ...attendance.toObject(),
      dateFormatted: formatDDMMYYYY(attendance.date)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Attendance records for an Employee
// @route   GET /api/hr/attendance/:employeeId
// @access  Private (hrAccess OR Self)
const getAttendanceByEmployee = async (req, res) => {
  const { employeeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return res.status(400).json({ message: 'Invalid employee User ID' });
  }

  const isSelf = req.user._id.toString() === employeeId;
  if (!isHROrDirector(req) && !isSelf) {
    return res.status(403).json({ message: 'Access denied. You can only view your own attendance records.' });
  }

  try {
    const { from, to } = req.query;
    const query = { employee: employeeId };

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = parseDateString(from);
      if (to) query.date.$lte = parseDateString(to, true);
    }

    const records = await Attendance.find(query).sort({ date: -1 });

    const formatted = records.map(r => ({
      ...r.toObject(),
      dateFormatted: formatDDMMYYYY(r.date)
    }));

    return res.json(formatted);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// LEAVE CONTROLLERS
// ============================================================

// @desc    Apply for Leave (Self service)
// @route   POST /api/hr/leave
// @access  Private (Authenticated User - Self service)
const applyLeave = async (req, res) => {
  const { leaveType, fromDate, toDate, reason } = req.body;

  if (!leaveType || !leaveType.trim()) {
    return res.status(400).json({ message: 'leaveType (e.g. Casual, Sick, Earned) is required' });
  }
  if (!fromDate || !toDate) {
    return res.status(400).json({ message: 'fromDate and toDate are required' });
  }

  const fDate = parseDateString(fromDate);
  const tDate = parseDateString(toDate, true);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setFullYear(today.getFullYear() + 1);
  maxDate.setHours(23, 59, 59, 999);

  if (fDate < today) {
    return res.status(400).json({ message: 'Past dates cannot be selected for leave application. Leave date must be from today onwards.' });
  }

  if (fDate > maxDate || tDate > maxDate) {
    return res.status(400).json({ message: 'Leave date cannot be further than 1 year ahead.' });
  }

  if (tDate < fDate) {
    return res.status(400).json({ message: 'toDate cannot be before fromDate' });
  }

  try {
    const leave = await Leave.create({
      employee: req.user._id,
      leaveType: leaveType.trim(),
      fromDate: fDate,
      toDate: tDate,
      reason: reason ? String(reason).trim() : '',
      status: 'Pending'
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'LEAVE_APPLIED',
      targetType: 'Leave',
      targetId: leave._id,
      metadata: { leaveType: leave.leaveType, fromDate: formatDDMMYYYY(fDate), toDate: formatDDMMYYYY(tDate) }
    });

    return res.status(201).json({
      ...leave.toObject(),
      fromDateFormatted: formatDDMMYYYY(leave.fromDate),
      toDateFormatted: formatDDMMYYYY(leave.toDate)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Leaves (hrAccess gets all, others get own)
// @route   GET /api/hr/leave
// @access  Private (Authenticated User)
const getLeaves = async (req, res) => {
  try {
    const { employee, status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (!isHROrDirector(req)) {
      query.employee = req.user._id;
    } else if (employee && mongoose.Types.ObjectId.isValid(employee)) {
      query.employee = employee;
    }

    if (status) query.status = status;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Leave.countDocuments(query);
    const leaves = await Leave.find(query)
      .populate('employee', 'name email department role')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const formatted = leaves.map(l => ({
      ...l.toObject(),
      fromDateFormatted: formatDDMMYYYY(l.fromDate),
      toDateFormatted: formatDDMMYYYY(l.toDate)
    }));

    return res.json({
      totalCount: total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      leaves: formatted
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Approve or Reject Leave (Auto-creates 'On Leave' Attendance on Approved)
// @route   PUT /api/hr/leave/:id/approve
// @access  Private (hrAccess permission holder)
const approveLeave = async (req, res) => {
  const decision = req.body.decision || req.body.status;

  if (!decision || !['Approved', 'Rejected'].includes(decision)) {
    return res.status(400).json({ message: "decision or status must be 'Approved' or 'Rejected'" });
  }

  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }

    leave.status = decision;
    leave.approvedBy = req.user._id;
    leave.approvedAt = new Date();
    await leave.save();

    let autoAttendanceCount = 0;

    // Auto-create/upsert 'On Leave' Attendance records for each date in range if Approved
    if (decision === 'Approved') {
      const cur = new Date(leave.fromDate);
      cur.setHours(0, 0, 0, 0);

      const end = new Date(leave.toDate);
      end.setHours(23, 59, 59, 999);

      while (cur <= end) {
        const dateCopy = new Date(cur);
        await Attendance.findOneAndUpdate(
          { employee: leave.employee, date: dateCopy },
          {
            employee: leave.employee,
            date: dateCopy,
            status: 'On Leave',
            markedBy: req.user._id
          },
          { upsert: true, new: true }
        );
        autoAttendanceCount++;
        cur.setDate(cur.getDate() + 1);
      }
    }

    await logActivity({
      req,
      userId: req.user._id,
      action: `LEAVE_${decision.toUpperCase()}`,
      targetType: 'Leave',
      targetId: leave._id,
      metadata: { decision, autoAttendanceCreatedCount: autoAttendanceCount }
    });

    const updated = await Leave.findById(leave._id)
      .populate('employee', 'name email')
      .populate('approvedBy', 'name email');

    return res.json({
      ...updated.toObject(),
      fromDateFormatted: formatDDMMYYYY(updated.fromDate),
      toDateFormatted: formatDDMMYYYY(updated.toDate),
      autoAttendanceCreatedCount: autoAttendanceCount
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// HOLIDAYS CONTROLLERS
// ============================================================

// @desc    Create a Holiday date
// @route   POST /api/hr/holidays
// @access  Private (hrAccess permission holder)
const createHoliday = async (req, res) => {
  const { name, holidayName, date, type } = req.body;
  const nameVal = name || holidayName;

  if (!nameVal || !nameVal.trim()) {
    return res.status(400).json({ message: 'Holiday name is required' });
  }
  if (!date) {
    return res.status(400).json({ message: 'Holiday date is required' });
  }

  const hDate = parseDateString(date);
  if (!hDate) {
    return res.status(400).json({ message: 'Valid holiday date is required' });
  }
  hDate.setHours(0, 0, 0, 0);

  try {
    const existing = await Holiday.findOne({ date: hDate });
    if (existing) {
      return res.status(400).json({ message: `Holiday already exists for date ${formatDDMMYYYY(hDate)} (${existing.name})` });
    }

    const holidayType = type || req.body.category || 'Festival';
    const holiday = await Holiday.create({
      name: nameVal.trim(),
      date: hDate,
      type: holidayType,
      category: holidayType
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'HOLIDAY_CREATED',
      targetType: 'Holiday',
      targetId: holiday._id,
      metadata: { name: holiday.name, date: formatDDMMYYYY(hDate) }
    });

    return res.status(201).json({
      ...holiday.toObject(),
      holidayName: holiday.name,
      dateFormatted: formatDDMMYYYY(holiday.date)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all Holidays
// @route   GET /api/hr/holidays
// @access  Private (Any authenticated user)
const getHolidays = async (req, res) => {
  try {
    const { year, from, to } = req.query;
    const query = {};

    if (year) {
      const y = parseInt(year, 10);
      query.date = { $gte: new Date(y, 0, 1), $lte: new Date(y, 11, 31, 23, 59, 59) };
    } else if (from || to) {
      query.date = {};
      if (from) query.date.$gte = parseDateString(from);
      if (to) query.date.$lte = parseDateString(to, true);
    }

    const holidays = await Holiday.find(query).sort({ date: 1 });

    const formatted = holidays.map(h => ({
      ...h.toObject(),
      dateFormatted: formatDDMMYYYY(h.date)
    }));

    return res.json(formatted);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a Holiday
// @route   DELETE /api/hr/holidays/:id
// @access  Private (hrAccess permission holder)
const deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ message: 'Holiday not found' });
    }

    await Holiday.findByIdAndDelete(holiday._id);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'HOLIDAY_DELETED',
      targetType: 'Holiday',
      targetId: holiday._id,
      metadata: { name: holiday.name }
    });

    return res.json({ message: `Holiday '${holiday.name}' deleted successfully` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// PERFORMANCE REVIEWS CONTROLLERS
// ============================================================

// @desc    Create Performance Review for an employee
// @route   POST /api/hr/performance-reviews
// @access  Private (hrAccess permission holder)
const createPerformanceReview = async (req, res) => {
  const { employee, reviewPeriod, rating, strengths, areasForImprovement, comments } = req.body;

  if (!employee || !mongoose.Types.ObjectId.isValid(employee)) {
    return res.status(400).json({ message: 'Valid employee User ID is required' });
  }
  if (!reviewPeriod || !reviewPeriod.trim()) {
    return res.status(400).json({ message: 'reviewPeriod (e.g. Q3 2026) is required' });
  }

  try {
    const targetUser = await User.findById(employee);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target employee user account not found' });
    }

    const review = await PerformanceReview.create({
      employee,
      reviewPeriod: reviewPeriod.trim(),
      reviewedBy: req.user._id,
      rating: rating ? Number(rating) : undefined,
      strengths: strengths ? String(strengths).trim() : '',
      areasForImprovement: areasForImprovement ? String(areasForImprovement).trim() : '',
      comments: comments ? String(comments).trim() : ''
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'PERFORMANCE_REVIEW_CREATED',
      targetType: 'PerformanceReview',
      targetId: review._id,
      metadata: { reviewPeriod: review.reviewPeriod, employee: targetUser.name }
    });

    const populated = await PerformanceReview.findById(review._id)
      .populate('employee', 'name email department role')
      .populate('reviewedBy', 'name email');

    return res.status(201).json(populated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Performance Reviews
// @route   GET /api/hr/performance-reviews
// @access  Private (hrAccess OR Self)
const getPerformanceReviews = async (req, res) => {
  try {
    const { employee, reviewPeriod } = req.query;
    const query = {};

    if (!isHROrDirector(req)) {
      query.employee = req.user._id;
    } else if (employee && mongoose.Types.ObjectId.isValid(employee)) {
      query.employee = employee;
    }

    if (reviewPeriod) query.reviewPeriod = reviewPeriod;

    const reviews = await PerformanceReview.find(query)
      .populate('employee', 'name email department role')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.json(reviews);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// HR REPORTS CONTROLLERS
// ============================================================

// @desc    HR Report 1: Attendance Report
// @route   GET /api/hr/reports/attendance
// @access  Private (hrAccess permission holder)
const getAttendanceReport = async (req, res) => {
  try {
    const { from, to } = req.query;

    const query = {};
    if (!isHROrDirector(req)) {
      query.employee = req.user._id;
    }

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = parseDateString(from);
      if (to) query.date.$lte = parseDateString(to, true);
    }

    const records = await Attendance.find(query).populate('employee', 'name email department');

    const summary = {
      totalRecords: records.length,
      presentCount: records.filter(r => r.status === 'Present').length,
      absentCount: records.filter(r => r.status === 'Absent').length,
      halfDayCount: records.filter(r => r.status === 'Half-day').length,
      onLeaveCount: records.filter(r => r.status === 'On Leave').length
    };

    return res.json({
      summary,
      attendanceDetails: records.map(r => ({
        ...r.toObject(),
        dateFormatted: formatDDMMYYYY(r.date)
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    HR Report 2: Leave Report
// @route   GET /api/hr/reports/leave
// @access  Private (hrAccess permission holder)
const getLeaveReport = async (req, res) => {
  try {
    const leaves = await Leave.find({}).populate('employee', 'name email department');

    const summary = {
      totalApplications: leaves.length,
      pendingCount: leaves.filter(l => l.status === 'Pending').length,
      approvedCount: leaves.filter(l => l.status === 'Approved').length,
      rejectedCount: leaves.filter(l => l.status === 'Rejected').length
    };

    return res.json({
      summary,
      leaves: leaves.map(l => ({
        ...l.toObject(),
        fromDateFormatted: formatDDMMYYYY(l.fromDate),
        toDateFormatted: formatDDMMYYYY(l.toDate)
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    HR Report 3: Employee Performance Aggregated Report
// @route   GET /api/hr/reports/employee-performance
// @access  Private (hrAccess permission holder)
const getPerformanceReport = async (req, res) => {
  try {
    const reviews = await PerformanceReview.find({})
      .populate('employee', 'name email department role')
      .populate('reviewedBy', 'name email')
      .sort({ rating: -1 });

    const avgRating = reviews.length > 0
      ? Number((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(2))
      : 0;

    return res.json({
      totalReviewsCount: reviews.length,
      averageRating: avgRating,
      reviews
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    HR Report 4: Department Strength (Delegates to Module 2)
// @route   GET /api/hr/reports/department-strength
// @access  Private (hrAccess permission holder)
const getDepartmentStrengthReport = async (req, res) => {
  try {
    const { getAllDepartmentsStrengthReport: mod2Report } = require('./departmentController');
    return await mod2Report(req, res);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    HR Report 5: Resource Utilization (Delegates to Module 8)
// @route   GET /api/hr/reports/resource-utilization
// @access  Private (hrAccess permission holder)
const getResourceUtilizationReport = async (req, res) => {
  try {
    const { getUtilization: mod8Utilization } = require('./resourceController');
    return await mod8Utilization(req, res);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    HR Report 6: Joining & Exit Report
// @route   GET /api/hr/reports/joining-exit
// @access  Private (hrAccess permission holder)
const getJoiningExitReport = async (req, res) => {
  try {
    const { from, to } = req.query;

    const fromDate = from ? parseDateString(from) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = to ? parseDateString(to, true) : new Date();

    const newJoiners = await Employee.find({
      dateOfJoining: { $gte: fromDate, $lte: toDate }
    }).populate('user', 'name email role department');

    const exitedEmployees = await Employee.find({
      dateOfExit: { $gte: fromDate, $lte: toDate }
    }).populate('user', 'name email role department');

    return res.json({
      queryWindow: { fromFormatted: formatDDMMYYYY(fromDate), toFormatted: formatDDMMYYYY(toDate) },
      newJoinersCount: newJoiners.length,
      exitedCount: exitedEmployees.length,
      newJoiners: newJoiners.map(e => ({ ...e.toObject(), dateOfJoiningFormatted: formatDDMMYYYY(e.dateOfJoining) })),
      exitedEmployees: exitedEmployees.map(e => ({ ...e.toObject(), dateOfExitFormatted: formatDDMMYYYY(e.dateOfExit) }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const { clockIn, clockOut, getTodayAttendance } = require('./attendanceController');

// @desc    Export Month-Wise Attendance (All Employees or Particular Employee) in PDF, Excel, or CSV
// @route   GET /api/hr/attendance/export
// @access  Private (hrAccess)
const exportAttendance = async (req, res) => {
  try {
    const { format = 'excel', month, from, to, employeeId } = req.query;

    let startDate, endDate;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, m] = month.split('-').map(Number);
      startDate = new Date(year, m - 1, 1);
      endDate = new Date(year, m, 0, 23, 59, 59);
    } else if (from || to) {
      startDate = from ? parseDateString(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      endDate = to ? parseDateString(to, true) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const monthName = startDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    let title = '';
    let headers = [];
    let rows = [];

    if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
      // Particular Employee Monthly Attendance Export
      const empUser = await User.findById(employeeId).select('name email role');
      const empName = empUser ? empUser.name : 'Employee';

      const records = await Attendance.find({
        employee: employeeId,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 });

      title = `Attendance Report â€” ${empName} (${monthName})`;
      headers = ['Date', 'Status', 'Clock In', 'Clock Out', 'Working Hours (hrs)', 'Late Arrival', 'Remarks'];

      rows = records.map(att => [
        formatDDMMYYYY(att.date),
        att.status || 'Present',
        att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        att.workingHours || 0,
        att.isLate ? 'YES' : 'NO',
        att.remarks || '-'
      ]);
    } else {
      // All Employees Monthly Attendance Export Summary
      const activeUsers = await User.find({ status: 'Active' })
        .populate('role', 'name')
        .select('name email role department');

      const employees = await Employee.find({ status: 'Active' }).select('user designation employeeCode');
      const empDesignationMap = {};
      employees.forEach(emp => {
        if (emp.user) {
          empDesignationMap[emp.user.toString()] = emp.designation;
        }
      });

      const userIds = activeUsers.map(u => u._id);

      const records = await Attendance.find({
        employee: { $in: userIds },
        date: { $gte: startDate, $lte: endDate }
      });

      title = `Studio Monthly Attendance Summary â€” ${monthName}`;
      headers = ['Employee Name', 'Email', 'Role / Designation', 'Present Days', 'Absent Days', 'Half Days', 'On Leave', 'Total Hours', 'Avg Daily Hours'];

      const userStatsMap = {};
      activeUsers.forEach(u => {
        let roleTitle = 'Staff';
        if (typeof u.role === 'object' && u.role?.name) {
          roleTitle = u.role.name;
        } else if (typeof u.role === 'string' && u.role) {
          roleTitle = u.role;
        } else if (empDesignationMap[u._id.toString()]) {
          roleTitle = empDesignationMap[u._id.toString()];
        }

        userStatsMap[u._id.toString()] = {
          name: u.name,
          email: u.email,
          role: roleTitle,
          present: 0,
          absent: 0,
          halfDay: 0,
          leave: 0,
          totalHours: 0
        };
      });

      records.forEach(att => {
        const uId = att.employee.toString();
        if (userStatsMap[uId]) {
          const st = (att.status || 'Present').toLowerCase();
          if (st === 'present') userStatsMap[uId].present += 1;
          else if (st === 'absent') userStatsMap[uId].absent += 1;
          else if (st === 'half-day' || st === 'half_day') userStatsMap[uId].halfDay += 1;
          else if (st === 'on leave' || st === 'leave' || st === 'on_leave') userStatsMap[uId].leave += 1;

          userStatsMap[uId].totalHours += Number(att.workingHours || 0);
        }
      });

      rows = Object.values(userStatsMap).map(s => {
        const avgHours = s.present > 0 ? (s.totalHours / s.present).toFixed(1) : '0.0';
        return [
          s.name,
          s.email,
          s.role,
          s.present,
          s.absent,
          s.halfDay,
          s.leave,
          s.totalHours.toFixed(1),
          avgHours
        ];
      });
    }

    const filename = `attendance-${monthName.replace(/\s+/g, '_').toLowerCase()}-${Date.now()}`;

    if (format === 'pdf') {
      return await streamPdf(res, title, headers, rows, filename);
    } else if (format === 'csv') {
      return streamCsv(res, title, headers, rows, filename);
    } else {
      return await streamExcel(res, title, headers, rows, filename);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


// @desc    Update Leave application (Self service, ONLY when status is Pending)
// @route   PUT /api/hr/leave/:id
// @access  Private (Applicant or HR)
const updateLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: 'Leave application not found' });
    }

    const isOwner = String(leave.employee) === String(req.user._id);
    if (!isOwner && !isHROrDirector(req)) {
      return res.status(403).json({ message: 'Not authorized to update this leave application' });
    }

    // STRICT RULE: Only pending leaves can be updated! Once Approved or Rejected, it cannot be modified!
    if (leave.status !== 'Pending') {
      return res.status(400).json({
        message: `Leave application cannot be modified once it has been ${leave.status.toLowerCase()}. Only pending leave applications can be updated.`
      });
    }

    const { leaveType, fromDate, toDate, reason } = req.body;
    if (leaveType) leave.leaveType = leaveType.trim();
    if (reason !== undefined) leave.reason = String(reason).trim();

    if (fromDate && toDate) {
      const fDate = parseDateString(fromDate);
      const tDate = parseDateString(toDate, true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maxDate = new Date(today);
      maxDate.setFullYear(today.getFullYear() + 1);
      maxDate.setHours(23, 59, 59, 999);

      if (fDate < today) {
        return res.status(400).json({ message: 'Past dates cannot be selected for leave application.' });
      }
      if (fDate > maxDate || tDate > maxDate) {
        return res.status(400).json({ message: 'Leave date cannot be further than 1 year ahead.' });
      }
      if (tDate < fDate) {
        return res.status(400).json({ message: 'End date cannot be earlier than start date.' });
      }

      leave.fromDate = fDate;
      leave.toDate = tDate;
    }

    await leave.save();

    const updated = await Leave.findById(leave._id)
      .populate('employee', 'name email department role');

    return res.json({
      ...updated.toObject(),
      fromDateFormatted: formatDDMMYYYY(updated.fromDate),
      toDateFormatted: formatDDMMYYYY(updated.toDate)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
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
  updateLeave,
  updateLeave,
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
};


// ============================================================
// LEAVE TYPE MASTER CONTROLLERS
// ============================================================

// @desc    Get all dynamic Leave Types (with auto-seeding default master types)
// @route   GET /api/hr/leave-types
const getLeaveTypes = async (req, res) => {
  try {
    let types = await LeaveType.find({ isActive: true }).sort({ createdAt: 1 });
    if (types.length === 0) {
      // Auto seed default master leave types if empty
      const defaults = [
        { name: 'Casual Leave', code: 'CL', daysAllowedPerYear: 12, colorCode: '#3B82F6', description: 'Routine casual leave entitlement' },
        { name: 'Sick Leave', code: 'SL', daysAllowedPerYear: 10, colorCode: '#EF4444', description: 'Medical and health related absence' },
        { name: 'Paid Leave / Earned Leave', code: 'PL', daysAllowedPerYear: 15, colorCode: '#10B981', description: 'Annual accumulated privilege leave' },
        { name: 'Maternity / Paternity Leave', code: 'ML', daysAllowedPerYear: 90, colorCode: '#8B5CF6', description: 'Parental welfare leave' },
        { name: 'Unpaid Leave / LWP', code: 'LWP', daysAllowedPerYear: 0, colorCode: '#6B7280', description: 'Leave without pay' }
      ];
      types = await LeaveType.insertMany(defaults);
    }
    return res.json({ success: true, count: types.length, data: types });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new Leave Type Master
// @route   POST /api/hr/leave-types
const createLeaveType = async (req, res) => {
  try {
    const { name, code, daysAllowedPerYear, description, colorCode } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Leave Type Name is required' });
    }
    const existing = await LeaveType.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Leave Type with this name already exists' });
    }
    const newType = await LeaveType.create({
      name: name.trim(),
      code: code ? code.toUpperCase().trim() : name.substring(0, 3).toUpperCase(),
      daysAllowedPerYear: Number(daysAllowedPerYear) || 12,
      description: description || '',
      colorCode: colorCode || '#B68D40'
    });
    return res.status(201).json({ success: true, data: newType });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Leave Type Master
// @route   PUT /api/hr/leave-types/:id
const updateLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, daysAllowedPerYear, description, colorCode } = req.body;
    const type = await LeaveType.findById(id);
    if (!type) {
      return res.status(404).json({ success: false, message: 'Leave Type not found' });
    }
    if (name) type.name = name.trim();
    if (code) type.code = code.toUpperCase().trim();
    if (daysAllowedPerYear !== undefined) type.daysAllowedPerYear = Number(daysAllowedPerYear);
    if (description !== undefined) type.description = description;
    if (colorCode) type.colorCode = colorCode;
    await type.save();
    return res.json({ success: true, data: type });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete (Soft Delete) Leave Type Master
// @route   DELETE /api/hr/leave-types/:id
const deleteLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const type = await LeaveType.findById(id);
    if (!type) {
      return res.status(404).json({ success: false, message: 'Leave Type not found' });
    }
    type.isActive = false;
    await type.save();
    return res.json({ success: true, message: 'Leave Type deactivated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
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
  updateLeave,
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
};
