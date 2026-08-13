const ArtistProfile = require('../models/ArtistProfile');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const logActivity = require('../utils/activityLogger');
const { formatDDMMYYYY, parseDateString, calculateWorkingDays, calculateWorkingDaysSync, getWeekdayDatesDDMMYYYY } = require('../utils/dateFormatter');
const mongoose = require('mongoose');

// Helper: Check if caller has Director, HR, PM, or Resource Allocation permissions
const isDirectorOrHR = (req) => {
  const roleName = req.user?.role?.name;
  const p = req.user?.role?.permissions;
  return roleName === 'Director' || roleName === 'Human Resource' || roleName === 'Production Manager' || p?.resourceAllocation || p?.projectManagement;
};

// @desc    Upsert Artist Profile (Skill Tags & Daily Capacity Hours)
// @route   POST /api/resources/artist-profile/:userId
// @access  Private (Director / HR only)
const upsertArtistProfile = async (req, res) => {
  if (!isDirectorOrHR(req)) {
    return res.status(403).json({ message: 'Access denied. Director or Human Resource role required to set artist profiles and skill tags.' });
  }

  const { dailyCapacityHours, skillTags, notes } = req.body;
  const targetUserId = req.params.userId;

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  try {
    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let profile = await ArtistProfile.findOne({ user: targetUserId });
    if (profile) {
      if (dailyCapacityHours !== undefined) profile.dailyCapacityHours = Number(dailyCapacityHours);
      if (Array.isArray(skillTags)) profile.skillTags = skillTags.map(s => String(s).trim());
      if (notes !== undefined) profile.notes = String(notes).trim();
      await profile.save();
    } else {
      profile = await ArtistProfile.create({
        user: targetUserId,
        dailyCapacityHours: dailyCapacityHours ? Number(dailyCapacityHours) : 8,
        skillTags: Array.isArray(skillTags) ? skillTags.map(s => String(s).trim()) : [],
        notes: notes ? String(notes).trim() : ''
      });
    }

    await logActivity({
      req,
      userId: req.user._id,
      action: 'ARTIST_PROFILE_UPDATED',
      targetType: 'ArtistProfile',
      targetId: profile._id,
      metadata: { targetUserId, skillTags: profile.skillTags, dailyCapacityHours: profile.dailyCapacityHours }
    });

    const populatedProfile = await ArtistProfile.findById(profile._id).populate('user', 'name email role department');
    return res.status(200).json(populatedProfile);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Artist Profile (Skill Tags & Capacity)
// @route   GET /api/resources/artist-profile/:userId
// @access  Private (Resource Allocation permission holder)
const getArtistProfile = async (req, res) => {
  const targetUserId = req.params.userId;
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  try {
    const user = await User.findById(targetUserId).select('name email role status');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profile = await ArtistProfile.findOne({ user: targetUserId });
    if (!profile) {
      return res.json({
        user,
        dailyCapacityHours: 8,
        skillTags: [],
        notes: '',
        isConfigured: false
      });
    }

    return res.json({
      _id: profile._id,
      user,
      dailyCapacityHours: profile.dailyCapacityHours,
      skillTags: profile.skillTags,
      notes: profile.notes,
      isConfigured: true,
      updatedAtFormatted: formatDDMMYYYY(profile.updatedAt),
      updatedAt: profile.updatedAt
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Artist Availability & Daily Workload Schedule
// @route   GET /api/resources/availability
// @access  Private (Resource Allocation permission holder)
const getAvailability = async (req, res) => {
  try {
    const { skill, from, to, excludeProjectId } = req.query;

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const defaultTo = new Date(defaultFrom.getTime() + 13 * 86400000);

    const fromDate = from ? parseDateString(from) : defaultFrom;
    const toDate = to ? parseDateString(to, true) : defaultTo;

    if (!fromDate || !toDate || fromDate > toDate) {
      return res.status(400).json({ message: 'Invalid date range' });
    }

    // 90-day maximum range guard
    const rangeDays = (toDate.getTime() - fromDate.getTime()) / 86400000;
    if (rangeDays > 90) {
      return res.status(400).json({ message: 'Date range query exceeds maximum limit of 90 days' });
    }

    // Fetch active artists (flexible status match)
    const activeUsers = await User.find({ status: { $ne: 'Inactive' } })
      .populate('role', 'name')
      .populate('department', 'name');

    const artistProfiles = await ArtistProfile.find({});
    const profileMap = {};
    artistProfiles.forEach(p => profileMap[p.user.toString()] = p);

    let artists = activeUsers;
    if (skill && skill.trim()) {
      const skillFilter = skill.trim().toLowerCase();
      artists = artists.filter(u => {
        const prof = profileMap[u._id.toString()];
        return prof && Array.isArray(prof.skillTags) && prof.skillTags.some(st => st.toLowerCase() === skillFilter);
      });
    }

    const artistIds = artists.map(u => u._id);

    // Helper: Get ALL calendar dates (including weekends) in DD/MM/YYYY
    const getAllCalendarDates = (startD, endD) => {
      const dates = [];
      const s = parseDateString(startD);
      const e = parseDateString(endD, true);
      if (!s || !e || s > e) return dates;
      const cur = new Date(s);
      cur.setHours(0,0,0,0);
      const finish = new Date(e);
      finish.setHours(0,0,0,0);
      while (cur <= finish) {
        dates.push(formatDDMMYYYY(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return dates;
    };

    // 1. Fetch active assigned tasks in window
    const tasks = await Task.find({
      assignee: { $in: artistIds },
      status: { $nin: ['Completed', 'Approved', 'Cancelled'] }
    }).populate('project', 'projectName');

    // 2. Fetch active assigned projects in window (proper Mongoose ObjectId array match)
    const projectFilter = {
      assignedTeam: { $in: artistIds },
      status: { $nin: ['Completed', 'Cancelled', 'completed', 'cancelled'] },
      isDeleted: { $ne: true }
    };
    if (excludeProjectId && mongoose.Types.ObjectId.isValid(excludeProjectId)) {
      projectFilter._id = { $ne: excludeProjectId };
    }

    const activeProjects = await Project.find(projectFilter);

    // Build per-artist daily load map and booked assignments list
    const dailyLoadMap = {};
    const artistBookedTasksMap = {};
    artistIds.forEach(id => {
      const strId = id.toString();
      dailyLoadMap[strId] = {};
      artistBookedTasksMap[strId] = [];
    });

    // Process Projects assignments
    activeProjects.forEach(proj => {
      if (!proj.startDate || !proj.endDate || !Array.isArray(proj.assignedTeam)) return;

      const pStart = new Date(proj.startDate);
      const pEnd = new Date(proj.endDate);
      if (isNaN(pStart.getTime()) || isNaN(pEnd.getTime())) return;

      proj.assignedTeam.forEach(member => {
        const memberStr = (member._id || member).toString();
        if (!dailyLoadMap[memberStr]) return;

        artistBookedTasksMap[memberStr].push({
          taskId: proj._id,
          title: `Project (${proj.projectName})`,
          project: proj.projectName || 'Project',
          startDate: formatDDMMYYYY(pStart),
          endDate: formatDDMMYYYY(pEnd),
          rawStartDate: pStart,
          rawEndDate: pEnd
        });

        // Mark all calendar days in project range as allocated 8 hrs
        const calendarDays = getAllCalendarDates(pStart, pEnd);
        calendarDays.forEach(dStr => {
          const dObj = parseDateString(dStr);
          if (dObj >= parseDateString(formatDDMMYYYY(fromDate)) && dObj <= parseDateString(formatDDMMYYYY(toDate))) {
            if (!dailyLoadMap[memberStr][dStr]) dailyLoadMap[memberStr][dStr] = 0;
            dailyLoadMap[memberStr][dStr] += 8;
          }
        });
      });
    });

    // Process Tasks assignments
    tasks.forEach(task => {
      if (!task.assignee) return;
      const tStart = task.startDate ? new Date(task.startDate) : (task.dueDate ? new Date(task.dueDate) : null);
      const tEnd = task.endDate ? new Date(task.endDate) : (task.dueDate ? new Date(task.dueDate) : null);
      if (!tStart || !tEnd || isNaN(tStart.getTime()) || isNaN(tEnd.getTime())) return;

      const calendarDays = getAllCalendarDates(tStart, tEnd);
      const workingDays = calendarDays.length || 1;
      const hours = task.estimatedHours ? Number(task.estimatedHours) : 8;
      const dailyHours = hours / workingDays;

      const artistStr = (task.assignee._id || task.assignee).toString();
      if (!dailyLoadMap[artistStr]) return;

      artistBookedTasksMap[artistStr].push({
        taskId: task._id,
        title: task.taskName || task.title || 'Task Assignment',
        project: task.project?.projectName || 'Task Assignment',
        startDate: formatDDMMYYYY(tStart),
        endDate: formatDDMMYYYY(tEnd),
        rawStartDate: tStart,
        rawEndDate: tEnd
      });

      calendarDays.forEach(dStr => {
        const dObj = parseDateString(dStr);
        if (dObj >= parseDateString(formatDDMMYYYY(fromDate)) && dObj <= parseDateString(formatDDMMYYYY(toDate))) {
          if (!dailyLoadMap[artistStr][dStr]) dailyLoadMap[artistStr][dStr] = 0;
          dailyLoadMap[artistStr][dStr] += dailyHours;
        }
      });
    });

    const windowCalendarDays = getAllCalendarDates(fromDate, toDate);

    const result = artists.map(artist => {
      const aId = artist._id.toString();
      const prof = profileMap[aId];
      const capacity = prof ? prof.dailyCapacityHours : 8;
      const skills = prof ? prof.skillTags : [];

      const dailySchedule = windowCalendarDays.map(dStr => {
        const allocated = Number((dailyLoadMap[aId][dStr] || 0).toFixed(2));
        const remaining = Number((capacity - allocated).toFixed(2));

        let status = 'Available';
        if (allocated > capacity) status = 'Over-Allocated';
        else if (allocated >= capacity) status = 'Fully Booked';

        return {
          date: dStr, // Formatted DD/MM/YYYY
          allocatedHours: allocated,
          remainingCapacityHours: remaining,
          status
        };
      });

      const artistTasks = artistBookedTasksMap[aId] || [];
      const totalAllocated = dailySchedule.reduce((sum, d) => sum + d.allocatedHours, 0);

      const freeDateList = dailySchedule.filter(d => d.status === 'Available').map(d => d.date);
      const conflictDateList = dailySchedule.filter(d => d.status === 'Fully Booked' || d.status === 'Over-Allocated').map(d => d.date);

      const formatSummaryDates = (dArr) => {
        if (!dArr || dArr.length === 0) return '';
        const firstParts = dArr[0].split('/');
        const lastParts = dArr[dArr.length - 1].split('/');
        const firstStr = `${parseInt(firstParts[0], 10)}/${parseInt(firstParts[1], 10)}`;
        const lastStr = `${parseInt(lastParts[0], 10)}/${parseInt(lastParts[1], 10)}`;
        return dArr.length === 1 ? firstStr : `${firstStr} to ${lastStr}`;
      };

      const freeDatesSummary = formatSummaryDates(freeDateList);
      const conflictDatesSummary = formatSummaryDates(conflictDateList);

      return {
        artistId: artist._id,
        _id: artist._id,
        user: artist,
        name: artist.name,
        email: artist.email,
        role: artist.role?.name,
        department: artist.department?.name,
        dailyCapacityHours: capacity,
        skillTags: skills,
        dailySchedule,
        assignedTasks: artistTasks,
        allocatedHours: totalAllocated,
        freeDatesSummary,
        conflictDatesSummary
      };
    });

    return res.json({
      dateFormat: 'DD/MM/YYYY',
      range: { from: formatDDMMYYYY(fromDate), to: formatDDMMYYYY(toDate), weekdayCount: windowWeekdays.length },
      totalArtists: result.length,
      artists: result
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Detailed Allocation for a specific Artist
// @route   GET /api/resources/:artistId/allocation
// @access  Private (Resource Allocation permission holder)
const getArtistAllocation = async (req, res) => {
  const { artistId } = req.params;
  const { from, to } = req.query;

  if (!mongoose.Types.ObjectId.isValid(artistId)) {
    return res.status(400).json({ message: 'Invalid artist ID' });
  }

  try {
    const artist = await User.findById(artistId).select('name email role status');
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const now = new Date();
    const fromDate = from ? parseDateString(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const toDate = to ? parseDateString(to, true) : new Date(fromDate.getTime() + 13 * 86400000);

    const profile = await ArtistProfile.findOne({ user: artistId });
    const capacity = profile ? profile.dailyCapacityHours : 8;

    const taskQuery = {
      assignee: artistId,
      status: { $nin: ['Completed', 'Approved', 'Cancelled'] }
    };

    if (from || to) {
      const fromDate = from ? parseDateString(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const toDate = to ? parseDateString(to, true) : new Date(fromDate.getTime() + 13 * 86400000);
      taskQuery.startDate = { $lte: toDate };
      taskQuery.endDate = { $gte: fromDate };
    }

    const tasks = await Task.find(taskQuery)
      .populate('project', 'projectName projectCategory')
      .populate('stage', 'stageName');

    const formattedTasks = tasks.map(t => {
      const workingDays = calculateWorkingDaysSync(t.startDate, t.endDate);
      const dailyHours = workingDays > 0 && t.estimatedHours ? Number((t.estimatedHours / workingDays).toFixed(2)) : 0;
      return {
        _id: t._id,
        taskId: t._id,
        taskName: t.taskName,
        projectName: t.project?.projectName || 'Project',
        projectCategory: t.project?.projectCategory || '',
        stageName: t.stage?.stageName || '',
        priority: t.priority,
        status: t.status,
        startDateFormatted: formatDDMMYYYY(t.startDate),
        endDateFormatted: formatDDMMYYYY(t.endDate),
        startDate: t.startDate,
        endDate: t.endDate,
        estimatedHours: t.estimatedHours || 0,
        allocatedHours: t.estimatedHours || 0,
        workingDays,
        dailyHoursContribution: dailyHours
      };
    });

    const totalAllocatedHours = formattedTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

    return res.json({
      artist,
      dailyCapacityHours: capacity,
      skillTags: profile ? profile.skillTags : [],
      dateFormat: 'DD/MM/YYYY',
      activeTasksCount: formattedTasks.length,
      totalAllocatedHours,
      tasks: formattedTasks,
      allocatedTasks: formattedTasks
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Over-Allocation Conflicts & Leave Conflict Detection
// @route   GET /api/resources/conflicts
// @access  Private (Resource Allocation permission holder)
const getConflicts = async (req, res) => {
  try {
    const { from, to, severity } = req.query;

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const defaultTo = new Date(defaultFrom.getTime() + 13 * 86400000);

    const fromDate = from ? parseDateString(from) : defaultFrom;
    const toDate = to ? parseDateString(to, true) : defaultTo;

    if (!fromDate || !toDate || fromDate > toDate) {
      return res.status(400).json({ message: 'Invalid date range' });
    }

    const rangeDays = (toDate.getTime() - fromDate.getTime()) / 86400000;
    if (rangeDays > 90) {
      return res.status(400).json({ message: 'Date range query exceeds maximum limit of 90 days' });
    }

    const activeUsers = await User.find({ status: 'Active' });
    const activeIds = activeUsers.map(u => u._id);

    const profiles = await ArtistProfile.find({ user: { $in: activeIds } });
    const profileMap = {};
    profiles.forEach(p => profileMap[p.user.toString()] = p);

    const tasks = await Task.find({
      assignee: { $in: activeIds },
      status: { $nin: ['Completed', 'Approved', 'Cancelled'] },
      startDate: { $lte: toDate },
      endDate: { $gte: fromDate }
    }).populate('project', 'projectName');

    const dailyLoadMap = {};
    const taskDetailsMap = {};
    activeIds.forEach(id => {
      dailyLoadMap[id.toString()] = {};
      taskDetailsMap[id.toString()] = {};
    });

    tasks.forEach(task => {
      if (!task.assignee || !task.startDate || !task.endDate || !task.estimatedHours) return;

      const workingDays = calculateWorkingDaysSync(task.startDate, task.endDate);
      if (workingDays === 0) return;

      const dailyHours = task.estimatedHours / workingDays;
      const weekdays = getWeekdayDatesDDMMYYYY(task.startDate, task.endDate);
      const aStr = task.assignee.toString();

      weekdays.forEach(dStr => {
        const dObj = parseDateString(dStr);
        if (dObj >= parseDateString(formatDDMMYYYY(fromDate)) && dObj <= parseDateString(formatDDMMYYYY(toDate))) {
          if (!dailyLoadMap[aStr][dStr]) dailyLoadMap[aStr][dStr] = 0;
          if (!taskDetailsMap[aStr][dStr]) taskDetailsMap[aStr][dStr] = [];

          dailyLoadMap[aStr][dStr] += dailyHours;
          taskDetailsMap[aStr][dStr].push({
            taskId: task._id,
            taskName: task.taskName,
            project: task.project?.projectName,
            dailyHours: Number(dailyHours.toFixed(2))
          });
        }
      });
    });

    const windowWeekdays = getWeekdayDatesDDMMYYYY(fromDate, toDate);
    const conflicts = [];

    activeUsers.forEach(artist => {
      const aId = artist._id.toString();
      const prof = profileMap[aId];
      const capacity = prof ? prof.dailyCapacityHours : 8;

      windowWeekdays.forEach(dStr => {
        const allocated = Number((dailyLoadMap[aId][dStr] || 0).toFixed(2));
        if (allocated > capacity) {
          const ratio = allocated / capacity;
          const confSeverity = ratio > 1.25 ? 'SEVERE' : 'MINOR';

          if (!severity || severity.toUpperCase() === confSeverity) {
            conflicts.push({
              artistId: artist._id,
              artistName: artist.name,
              email: artist.email,
              date: dStr, // Formatted DD/MM/YYYY
              dailyCapacityHours: capacity,
              allocatedHours: allocated,
              excessHours: Number((allocated - capacity).toFixed(2)),
              overAllocationPercentage: Number((ratio * 100).toFixed(1)),
              severity: confSeverity,
              conflictingTasks: taskDetailsMap[aId][dStr] || []
            });
          }
        }
      });
    });

    // Populate Module 10 Leave Conflict Detection
    const leaveConflicts = [];
    if (mongoose.models.Leave) {
      const approvedLeaves = await mongoose.models.Leave.find({
        employee: { $in: activeIds },
        status: 'Approved',
        fromDate: { $lte: toDate },
        toDate: { $gte: fromDate }
      }).populate('employee', 'name email');

      approvedLeaves.forEach(l => {
        const empId = l.employee._id.toString();
        const curL = new Date(l.fromDate);
        const endL = new Date(l.toDate);

        while (curL <= endL) {
          const dStr = formatDDMMYYYY(curL);
          const tasksAssigned = taskDetailsMap[empId] && taskDetailsMap[empId][dStr];

          if (tasksAssigned && tasksAssigned.length > 0) {
            leaveConflicts.push({
              artistId: l.employee._id,
              artistName: l.employee.name,
              email: l.employee.email,
              date: dStr,
              leaveType: l.leaveType,
              conflictType: 'LEAVE_OVERLAP',
              assignedTasksCount: tasksAssigned.length,
              assignedTasks: tasksAssigned
            });
          }
          curL.setDate(curL.getDate() + 1);
        }
      });
    }

    return res.json({
      dateFormat: 'DD/MM/YYYY',
      range: { from: formatDDMMYYYY(fromDate), to: formatDDMMYYYY(toDate) },
      totalOverAllocationConflicts: conflicts.length,
      overAllocationConflicts: conflicts,
      totalLeaveConflicts: leaveConflicts.length,
      leaveConflicts
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Resource Utilization Percentage Analytics
// @route   GET /api/resources/utilization
// @access  Private (Resource Allocation permission holder)
const getUtilization = async (req, res) => {
  try {
    const { from, to, artist } = req.query;

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const fromDate = from ? parseDateString(from) : defaultFrom;
    const toDate = to ? parseDateString(to, true) : defaultTo;

    if (!fromDate || !toDate || fromDate > toDate) {
      return res.status(400).json({ message: 'Invalid date range' });
    }

    const windowWeekdays = getWeekdayDatesDDMMYYYY(fromDate, toDate);
    const availableWorkingDaysCount = windowWeekdays.length;

    const userQuery = { status: 'Active' };
    if (artist && mongoose.Types.ObjectId.isValid(artist)) {
      userQuery._id = artist;
    }

    const activeUsers = await User.find(userQuery).select('name email role department');
    const activeIds = activeUsers.map(u => u._id);

    const profiles = await ArtistProfile.find({ user: { $in: activeIds } });
    const profileMap = {};
    profiles.forEach(p => profileMap[p.user.toString()] = p);

    const tasks = await Task.find({
      assignee: { $in: activeIds },
      status: { $nin: ['Cancelled'] },
      startDate: { $lte: toDate },
      endDate: { $gte: fromDate }
    });

    const artistTotalAllocated = {};
    activeIds.forEach(id => artistTotalAllocated[id.toString()] = 0);

    tasks.forEach(task => {
      if (!task.assignee || !task.startDate || !task.endDate || !task.estimatedHours) return;

      const workingDays = calculateWorkingDaysSync(task.startDate, task.endDate);
      if (workingDays === 0) return;

      const dailyHours = task.estimatedHours / workingDays;
      const weekdays = getWeekdayDatesDDMMYYYY(task.startDate, task.endDate);
      const aStr = task.assignee.toString();

      weekdays.forEach(dStr => {
        const dObj = parseDateString(dStr);
        if (dObj >= parseDateString(formatDDMMYYYY(fromDate)) && dObj <= parseDateString(formatDDMMYYYY(toDate))) {
          if (artistTotalAllocated[aStr] !== undefined) {
            artistTotalAllocated[aStr] += dailyHours;
          }
        }
      });
    });

    let studioTotalAllocated = 0;
    let studioTotalCapacity = 0;

    const artistUtilization = activeUsers.map(u => {
      const aId = u._id.toString();
      const prof = profileMap[aId];
      const capacityPerDay = prof ? prof.dailyCapacityHours : 8;

      const totalAllocated = Number((artistTotalAllocated[aId] || 0).toFixed(2));
      const totalAvailableCapacity = capacityPerDay * availableWorkingDaysCount;

      studioTotalAllocated += totalAllocated;
      studioTotalCapacity += totalAvailableCapacity;

      const utilPct = availableWorkingDaysCount > 0
        ? Number(((totalAllocated / totalAvailableCapacity) * 100).toFixed(2))
        : null;

      return {
        artistId: u._id,
        name: u.name,
        email: u.email,
        dailyCapacityHours: capacityPerDay,
        skillTags: prof ? prof.skillTags : [],
        totalAllocatedHours: totalAllocated,
        totalAvailableCapacityHours: totalAvailableCapacity,
        utilizationPercentage: utilPct
      };
    });

    const studioWideAverageUtilization = studioTotalCapacity > 0
      ? Number(((studioTotalAllocated / studioTotalCapacity) * 100).toFixed(2))
      : null;

    return res.json({
      dateFormat: 'DD/MM/YYYY',
      range: { from: formatDDMMYYYY(fromDate), to: formatDDMMYYYY(toDate), workingDaysCount: availableWorkingDaysCount },
      studioWideAverageUtilization,
      totalArtistsCount: artistUtilization.length,
      artists: artistUtilization
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Forecast Allocation for Upcoming Projects
// @route   GET /api/resources/forecast
// @access  Private (Resource Allocation permission holder)
const getForecast = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const now = new Date();
    const start = fromDate ? parseDateString(fromDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = toDate ? parseDateString(toDate, true) : new Date(start.getTime() + 60 * 86400000);

    const upcomingProjects = await Project.find({
      status: 'Not Started',
      isDeleted: { $ne: true },
      startDate: { $gte: start, $lte: end }
    }).populate('client', 'companyName');

    const projectIds = upcomingProjects.map(p => p._id);
    const unstartedTasks = await Task.find({ project: { $in: projectIds }, status: 'Pending' });

    // Heuristic skill inference keyword dictionary
    const skillKeywords = {
      '3D Modeling': ['model', 'modeling', 'geometry', 'sofa', 'building', 'structure'],
      'Texturing': ['texture', 'texturing', 'pbr', 'material', 'shading'],
      'Lighting': ['light', 'lighting', 'ies', 'daylight', 'atmosphere', 'sketch'],
      'Rendering': ['render', 'rendering', 'pass', '8k', 'batch'],
      'Animation': ['anim', 'animation', 'camera', 'track', 'motion', 'keyframe'],
      'Post Production': ['post', 'photoshop', 'grading', 'compositing', 'editing']
    };

    const demandBySkill = {
      '3D Modeling': 0,
      'Texturing': 0,
      'Lighting': 0,
      'Rendering': 0,
      'Animation': 0,
      'Post Production': 0,
      'General / Unclassified': 0
    };

    let totalProjectedHours = 0;

    unstartedTasks.forEach(task => {
      const est = task.estimatedHours || 8;
      totalProjectedHours += est;

      const nameLower = (task.taskName || '').toLowerCase();
      let matched = false;

      for (const [skill, keywords] of Object.entries(skillKeywords)) {
        if (keywords.some(kw => nameLower.includes(kw))) {
          demandBySkill[skill] += est;
          matched = true;
          break;
        }
      }

      if (!matched) {
        demandBySkill['General / Unclassified'] += est;
      }
    });

    return res.json({
      dateFormat: 'DD/MM/YYYY',
      forecastWindow: { from: formatDDMMYYYY(start), to: formatDDMMYYYY(end) },
      upcomingProjectsCount: upcomingProjects.length,
      upcomingProjects: upcomingProjects.map(p => ({
        projectId: p._id,
        projectName: p.projectName,
        projectCategory: p.projectCategory,
        startDateFormatted: formatDDMMYYYY(p.startDate),
        endDateFormatted: formatDDMMYYYY(p.endDate),
        startDate: p.startDate,
        endDate: p.endDate,
        client: p.client?.companyName
      })),
      totalProjectedDemandHours: totalProjectedHours,
      projectedDemandBySkill: demandBySkill,
      disclaimer: 'Skill requirement matching is an approximate heuristic based on task naming conventions for upcoming planning purposes.'
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete/Reset Artist Profile (Director / HR only)
// @route   DELETE /api/resources/artist-profile/:userId
// @access  Private (Director / HR only)
const deleteArtistProfile = async (req, res) => {
  if (!isDirectorOrHR(req)) {
    return res.status(403).json({ message: 'Access denied. Director or Human Resource role required to delete artist profiles.' });
  }

  const targetUserId = req.params.userId;
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  try {
    const profile = await ArtistProfile.findOneAndDelete({ user: targetUserId });
    if (profile) {
      await logActivity({
        req,
        userId: req.user._id,
        action: 'ARTIST_PROFILE_DELETED',
        targetType: 'ArtistProfile',
        targetId: profile._id,
        metadata: { targetUserId }
      });
    }

    return res.json({ message: 'Artist profile reset to default baseline (capacity: 8h, empty skills)' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  upsertArtistProfile,
  getArtistProfile,
  deleteArtistProfile,
  getAvailability,
  getArtistAllocation,
  getConflicts,
  getUtilization,
  getForecast
};
