const Project = require('../models/Project');
const Stage = require('../models/Stage');
const Task = require('../models/Task');
const Enquiry = require('../models/Enquiry');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Department = require('../models/Department');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const PerformanceReview = require('../models/PerformanceReview');
const ArtistProfile = require('../models/ArtistProfile');
const { formatDDMMYYYY, parseDateString, calculateWorkingDays } = require('../utils/dateFormatter');
const mongoose = require('mongoose');

const { getCache, setCache } = require('../utils/cacheEngine');

// Helper: Safely unpack Promise.allSettled result with fallback
const unpackSettled = (result, fallback = null) => {
  if (result.status === 'fulfilled') return result.value;
  console.warn('[Dashboard Warning] Sub-query failed:', result.reason);
  return fallback;
};

// Helper: Check if user is Director or has systemConfiguration permission
const isDirector = (user) => {
  return user?.role?.name === 'Director' || user?.role?.permissions?.systemConfiguration === true;
};

// ============================================================
// DIRECTOR DASHBOARD
// ============================================================

// @desc    Get Director Dashboard (Studio-wide complete visibility)
// @route   GET /api/dashboard/director
// @access  Private (Director ONLY - systemConfiguration)
const getDirectorDashboard = async (req, res) => {
  if (!isDirector(req.user)) {
    return res.status(403).json({ message: 'Access denied. Director role required for Director Dashboard.' });
  }

  const cacheKey = `dashboard_director_${req.user._id}`;
  const cachedData = getCache(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1, 0, 0, 0);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const [
      totalProjectsRes,
      activeProjectsRes,
      delayedProjectsRes,
      billedRevenueRes,
      cashflowRevenueRes,
      outstandingRes,
      pipelineRes,
      utilizationRes,
      productivityTrendsRes,
      deptPerformanceRes
    ] = await Promise.allSettled([
      // 1. Total Projects
      Project.countDocuments({ isDeleted: { $ne: true } }),

      // 2. Active Projects
      Project.countDocuments({ isDeleted: { $ne: true }, status: 'In Progress' }),

      // 3. Delayed Projects
      (async () => {
        const { getDelayedProjectsLogic } = require('./projectController');
        if (typeof getDelayedProjectsLogic === 'function') {
          return await getDelayedProjectsLogic();
        }
        return await Project.countDocuments({ isDeleted: { $ne: true }, status: 'Delayed' });
      })(),

      // 4. Billed Revenue (Current Year)
      Invoice.aggregate([
        { $match: { issueDate: { $gte: startOfYear, $lte: endOfYear } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),

      // 5. Cashflow Revenue (Current Year)
      Payment.aggregate([
        { $match: { paymentDate: { $gte: startOfYear, $lte: endOfYear } } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),

      // 6. Outstanding Dues Summary
      Invoice.find({ status: { $in: ['Pending', 'Overdue', 'Partially Paid'] } }),

      // 7. Business Pipeline (Enquiry Status Grouping)
      Enquiry.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, totalEstimatedValue: { $sum: '$estimatedValue' } } }
      ]),

      // 8. Studio-wide Team Utilization Average
      (async () => {
        const activeUsers = await User.find({ status: 'Active' }).select('_id');
        const profiles = await ArtistProfile.find({});
        const avgCap = profiles.length > 0 ? (profiles.reduce((s, p) => s + p.dailyCapacityHours, 0) / profiles.length) : 8;
        return { activeArtistsCount: activeUsers.length, defaultCapacityHours: Number(avgCap.toFixed(1)) };
      })(),

      // 9. Productivity Trends (Last 12 Weeks Task Completion Rate)
      (async () => {
        const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 86400000);
        const tasks = await Task.find({
          updatedAt: { $gte: twelveWeeksAgo },
          status: { $in: ['Completed', 'Approved'] }
        });
        const completedCount = tasks.length;
        const totalRecent = await Task.countDocuments({ createdAt: { $gte: twelveWeeksAgo } });
        const completionRate = totalRecent > 0 ? Number(((completedCount / totalRecent) * 100).toFixed(1)) : 100;
        return { completedInWindow: completedCount, totalCreatedInWindow: totalRecent, completionRatePercentage: completionRate };
      })(),

      // 10. Department Performance Breakdown (Task completion grouped by Department)
      (async () => {
        const depts = await Department.find({ status: 'Active' });
        const deptPerformance = [];

        for (const d of depts) {
          const deptUsers = await User.find({ department: d._id }).select('_id');
          const uIds = deptUsers.map(u => u._id);

          const totalDeptTasks = await Task.countDocuments({ assignee: { $in: uIds } });
          const completedDeptTasks = await Task.countDocuments({ assignee: { $in: uIds }, status: { $in: ['Completed', 'Approved'] } });
          const completionRate = totalDeptTasks > 0 ? Number(((completedDeptTasks / totalDeptTasks) * 100).toFixed(1)) : 100;

          deptPerformance.push({
            departmentId: d._id,
            departmentName: d.name,
            totalAssignedTasks: totalDeptTasks,
            completedTasks: completedDeptTasks,
            completionRatePercentage: completionRate
          });
        }
        return deptPerformance;
      })()
    ]);

    const totalProjects = unpackSettled(totalProjectsRes, 0);
    const activeProjects = unpackSettled(activeProjectsRes, 0);
    const delayedProjects = unpackSettled(delayedProjectsRes, 0);

    const billedRaw = unpackSettled(billedRevenueRes, []);
    const billedRevenue = billedRaw && billedRaw[0] ? Number(billedRaw[0].total.toFixed(2)) : 0;

    const cashflowRaw = unpackSettled(cashflowRevenueRes, []);
    const cashflowRevenue = cashflowRaw && cashflowRaw[0] ? Number(cashflowRaw[0].total.toFixed(2)) : 0;

    const unpaidInvoices = unpackSettled(outstandingRes, []);
    let studioTotalOutstanding = 0;
    if (Array.isArray(unpaidInvoices)) {
      studioTotalOutstanding = Number(unpaidInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0).toFixed(2));
    }

    const pipelineRaw = unpackSettled(pipelineRes, []);
    const pipelineMap = {};
    if (Array.isArray(pipelineRaw)) {
      pipelineRaw.forEach(p => pipelineMap[p._id] = { count: p.count, totalEstimatedValue: p.totalEstimatedValue || 0 });
    }

    const responsePayload = {
      role: 'Director',
      year: currentYear,
      dateFormat: 'DD/MM/YYYY',
      kpis: {
        totalProjects,
        activeProjects,
        delayedProjects,
        revenue: {
          billedRevenueCurrentYear: billedRevenue,
          cashflowRevenueCurrentYear: cashflowRevenue
        },
        outstandingPayments: {
          studioTotalOutstanding,
          unpaidInvoicesCount: Array.isArray(unpaidInvoices) ? unpaidInvoices.length : 0
        },
        teamUtilization: unpackSettled(utilizationRes, { activeArtistsCount: 0, defaultCapacityHours: 8 }),
        productivityTrends: unpackSettled(productivityTrendsRes, { completedInWindow: 0, totalCreatedInWindow: 0, completionRatePercentage: 100 }),
        departmentPerformance: unpackSettled(deptPerformanceRes, []),
        businessPipeline: pipelineMap
      }
    };

    setCache(cacheKey, responsePayload, 120);
    return res.json(responsePayload);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// PRODUCTION MANAGER DASHBOARD
// ============================================================

// @desc    Get Production Manager Dashboard (Scoped to PM's visible projects & team)
// @route   GET /api/dashboard/production-manager
// @access  Private (PM or Director)
const getPMDashboard = async (req, res) => {
  const isPM = req.user?.role?.name === 'Production Manager' || isDirector(req.user) || req.user?.role?.permissions?.projectManagement === true;
  if (!isPM) {
    return res.status(403).json({ message: 'Access denied. Production Manager or Director role required.' });
  }

  const cacheKey = `dashboard_pm_${req.user._id}`;
  const cachedData = getCache(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  try {
    const userId = req.user._id;

    // PM Visibility filter (matches Module 5 Section 8)
    const projectQuery = { isDeleted: { $ne: true } };
    if (!isDirector(req.user)) {
      projectQuery.$or = [
        { productionManager: userId },
        { assignedTeam: userId }
      ];
      if (req.user.department) {
        const deptUsers = await User.find({ department: req.user.department }).select('_id');
        projectQuery.$or.push({ productionManager: { $in: deptUsers.map(u => u._id) } });
      }
    }

    const visibleProjects = await Project.find(projectQuery).select('_id projectName projectCategory status progressPercentage startDate endDate');
    const visibleProjectIds = visibleProjects.map(p => p._id);

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 86400000);

    const [
      activeProjectsCountRes,
      delayedTasksRes,
      upcomingDeadlinesRes,
      teamMembersRes
    ] = await Promise.allSettled([
      // 1. PM Active Projects Count
      Project.countDocuments({ _id: { $in: visibleProjectIds }, status: 'In Progress' }),

      // 2. Delayed Tasks in PM Projects
      Task.find({
        project: { $in: visibleProjectIds },
        endDate: { $lt: now },
        status: { $nin: ['Completed', 'Approved', 'Cancelled'] }
      }).populate('assignee', 'name email').populate('project', 'projectName'),

      // 3. Upcoming Task Deadlines (Next 7 Days)
      Task.find({
        project: { $in: visibleProjectIds },
        endDate: { $gte: now, $lte: sevenDaysLater },
        status: { $nin: ['Completed', 'Approved', 'Cancelled'] }
      }).populate('assignee', 'name email').populate('project', 'projectName').sort({ endDate: 1 }),

      // 4. Assigned Team Members
      User.find({ status: 'Active' }).select('name email role department')
    ]);

    const activeProjectsCount = unpackSettled(activeProjectsCountRes, 0);
    const delayedTasks = unpackSettled(delayedTasksRes, []);
    const upcomingDeadlines = unpackSettled(upcomingDeadlinesRes, []);
    const teamMembers = unpackSettled(teamMembersRes, []);

    // Average Stage Progress across PM's visible projects
    const totalProgressSum = visibleProjects.reduce((sum, p) => sum + (p.progressPercentage || 0), 0);
    const averageStageProgressPercentage = visibleProjects.length > 0
      ? Number((totalProgressSum / visibleProjects.length).toFixed(1))
      : 0;

    const responsePayload = {
      role: req.user?.role?.name || 'Production Manager',
      dateFormat: 'DD/MM/YYYY',
      kpis: {
        totalVisibleProjects: visibleProjects.length,
        activeProjectsCount,
        averageStageProgressPercentage,
        delayedTasksCount: delayedTasks.length,
        delayedTasks: delayedTasks.map(t => ({
          taskId: t._id,
          taskName: t.taskName,
          project: t.project?.projectName,
          assignee: t.assignee?.name,
          dueDateFormatted: formatDDMMYYYY(t.endDate),
          status: t.status
        })),
        upcomingDeadlinesCount: upcomingDeadlines.length,
        upcomingDeadlines: upcomingDeadlines.map(t => ({
          taskId: t._id,
          taskName: t.taskName,
          project: t.project?.projectName,
          assignee: t.assignee?.name,
          dueDateFormatted: formatDDMMYYYY(t.endDate),
          status: t.status
        })),
        teamSize: teamMembers.length
      }
    };

    setCache(cacheKey, responsePayload, 120);
    return res.json(responsePayload);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// ARTIST DASHBOARD
// ============================================================

// @desc    Get Artist Dashboard (Strictly self-scoped to req.user._id)
// @route   GET /api/dashboard/artist
// @access  Private (Artist or Director oversight)
const getArtistDashboard = async (req, res) => {
  const cacheKey = `dashboard_artist_${req.user._id}`;
  const cachedData = getCache(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  try {
    const artistUserId = req.user._id;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const sevenDaysLater = new Date(now.getTime() + 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const [
      assignedTasksRes,
      todayTasksRes,
      pendingReviewsRes,
      upcomingDeadlinesRes,
      productivityRes
    ] = await Promise.allSettled([
      // 1. Assigned Active Tasks
      Task.find({
        assignee: artistUserId,
        status: { $nin: ['Completed', 'Approved', 'Cancelled'] }
      }).populate('project', 'projectName projectCategory').sort({ endDate: 1 }),

      // 2. Today's Due Tasks
      Task.find({
        assignee: artistUserId,
        endDate: { $gte: startOfToday, $lte: endOfToday }
      }).populate('project', 'projectName'),

      // 3. Pending Review Submissions
      Task.find({
        assignee: artistUserId,
        status: 'Under Review'
      }).populate('project', 'projectName').populate('reviewer', 'name email'),

      // 4. Upcoming Deadlines (Next 7 Days)
      Task.find({
        assignee: artistUserId,
        endDate: { $gte: now, $lte: sevenDaysLater },
        status: { $nin: ['Completed', 'Approved', 'Cancelled'] }
      }).sort({ endDate: 1 }),

      // 5. Personal Productivity Rate (Last 30 Days)
      (async () => {
        const tasks30Days = await Task.find({
          assignee: artistUserId,
          updatedAt: { $gte: thirtyDaysAgo }
        });
        const completed = tasks30Days.filter(t => ['Completed', 'Approved'].includes(t.status)).length;
        const rate = tasks30Days.length > 0 ? Number(((completed / tasks30Days.length) * 100).toFixed(1)) : 100;
        return { completedIn30Days: completed, totalAssignedIn30Days: tasks30Days.length, completionRatePercentage: rate };
      })()
    ]);

    const assignedTasks = unpackSettled(assignedTasksRes, []);
    const todayTasks = unpackSettled(todayTasksRes, []);
    const pendingReviews = unpackSettled(pendingReviewsRes, []);
    const upcomingDeadlines = unpackSettled(upcomingDeadlinesRes, []);
    const productivity = unpackSettled(productivityRes, { completedIn30Days: 0, totalAssignedIn30Days: 0, completionRatePercentage: 100 });

    const responsePayload = {
      role: req.user?.role?.name || 'Artist',
      artist: { _id: req.user._id, name: req.user.name, email: req.user.email },
      dateFormat: 'DD/MM/YYYY',
      kpis: {
        assignedTasksCount: assignedTasks.length,
        assignedTasks: assignedTasks.map(t => ({
          taskId: t._id,
          taskName: t.taskName,
          project: t.project?.projectName,
          category: t.project?.projectCategory,
          status: t.status,
          priority: t.priority,
          startDateFormatted: formatDDMMYYYY(t.startDate),
          endDateFormatted: formatDDMMYYYY(t.endDate)
        })),
        todayTasksCount: todayTasks.length,
        todayTasks: todayTasks.map(t => ({ taskId: t._id, taskName: t.taskName, status: t.status, project: t.project?.projectName })),
        pendingReviewsCount: pendingReviews.length,
        pendingReviews: pendingReviews.map(t => ({ taskId: t._id, taskName: t.taskName, project: t.project?.projectName, reviewer: t.reviewer?.name })),
        upcomingDeadlinesCount: upcomingDeadlines.length,
        upcomingDeadlines: upcomingDeadlines.map(t => ({ taskId: t._id, taskName: t.taskName, endDateFormatted: formatDDMMYYYY(t.endDate), status: t.status })),
        personalProductivitySummary: productivity
      }
    };

    setCache(cacheKey, responsePayload, 120);
    return res.json(responsePayload);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// HR DASHBOARD
// ============================================================

// @desc    Get HR Dashboard (Attendance, Leaves, Department Strength, Performance)
// @route   GET /api/dashboard/hr
// @access  Private (HR or Director)
const getHRDashboard = async (req, res) => {
  const isHR = req.user?.role?.name === 'Human Resource' || isDirector(req.user) || req.user?.role?.permissions?.hrAccess === true;
  if (!isHR) {
    return res.status(403).json({ message: 'Access denied. Human Resource or Director role required.' });
  }

  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const [
      attendanceTodayRes,
      pendingLeavesRes,
      deptStrengthRes,
      recentReviewsRes
    ] = await Promise.allSettled([
      // 1. Today's Attendance Summary
      Attendance.find({ date: { $gte: startOfToday, $lte: endOfToday } }).populate('employee', 'name email department'),

      // 2. Pending Leave Applications
      Leave.find({ status: 'Pending' }).populate('employee', 'name email department').sort({ createdAt: -1 }),

      // 3. Department Strength Breakdown (Delegated)
      (async () => {
        const { getAllDepartmentsStrengthReport: mod2Report } = require('./departmentController');
        const mockRes = { json: (data) => data, status: () => mockRes };
        return await mod2Report({}, mockRes);
      })(),

      // 4. Recent Performance Reviews
      PerformanceReview.find({}).populate('employee', 'name email').populate('reviewedBy', 'name email').sort({ createdAt: -1 }).limit(5)
    ]);

    const attToday = unpackSettled(attendanceTodayRes, []);
    const pendingLeaves = unpackSettled(pendingLeavesRes, []);
    const deptStrength = unpackSettled(deptStrengthRes, { summary: {}, departments: [] });
    const recentReviews = unpackSettled(recentReviewsRes, []);

    const attendanceSummary = {
      totalMarkedToday: attToday.length,
      presentCount: attToday.filter(a => a.status === 'Present').length,
      absentCount: attToday.filter(a => a.status === 'Absent').length,
      halfDayCount: attToday.filter(a => a.status === 'Half-day').length,
      onLeaveCount: attToday.filter(a => a.status === 'On Leave').length
    };

    return res.json({
      role: req.user?.role?.name || 'Human Resource',
      dateFormat: 'DD/MM/YYYY',
      kpis: {
        attendanceSummaryToday: attendanceSummary,
        pendingLeaveRequestsCount: pendingLeaves.length,
        pendingLeaveRequests: pendingLeaves.map(l => ({
          leaveId: l._id,
          employee: l.employee?.name,
          leaveType: l.leaveType,
          fromDateFormatted: formatDDMMYYYY(l.fromDate),
          toDateFormatted: formatDDMMYYYY(l.toDate),
          reason: l.reason
        })),
        departmentStrengthSummary: deptStrength.summary || {},
        departmentBreakdown: deptStrength.departments || [],
        recentPerformanceReviewsCount: recentReviews.length,
        recentPerformanceReviews: recentReviews.map(r => ({
          reviewId: r._id,
          employee: r.employee?.name,
          period: r.reviewPeriod,
          rating: r.rating,
          reviewedBy: r.reviewedBy?.name
        }))
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// BUSINESS DEVELOPMENT DASHBOARD
// ============================================================

// @desc    Get Business Development Dashboard (Enquiries, Meetings, Pipeline, Conversion)
// @route   GET /api/dashboard/bd
// @access  Private (BD Manager or Director)
const getBDDashboard = async (req, res) => {
  const isBD = req.user?.role?.name === 'Business Development Manager' || isDirector(req.user) || req.user?.role?.permissions?.businessDevAccess === true;
  if (!isBD) {
    return res.status(403).json({ message: 'Access denied. Business Development Manager or Director role required.' });
  }

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const [
      newEnquiriesRes,
      pipelineReportRes,
      conversionReportRes,
      followUpReportRes,
      revenueForecastRes,
      proposalEnquiriesRes
    ] = await Promise.allSettled([
      // 1. New Enquiries (Last 30 Days)
      Enquiry.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),

      // 2. Pipeline Report (Delegated)
      Enquiry.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, totalValue: { $sum: '$estimatedValue' } } }
      ]),

      // 3. Conversion Report
      (async () => {
        const totalClosed = await Enquiry.countDocuments({ status: { $in: ['Won', 'Lost', 'Project Creation'] } });
        const wonCount = await Enquiry.countDocuments({ status: { $in: ['Won', 'Project Creation'] } });
        const rate = totalClosed > 0 ? Number(((wonCount / totalClosed) * 100).toFixed(1)) : 0;
        return { totalClosed, wonCount, conversionRatePercentage: rate };
      })(),

      // 4. Overdue & Due-Today Follow-up Reminders
      (async () => {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const overdue = await Enquiry.find({
          status: { $nin: ['Won', 'Lost', 'Project Creation'] },
          followUpDate: { $lt: startOfToday }
        }).select('projectName clientName followUpDate status');

        const dueToday = await Enquiry.find({
          status: { $nin: ['Won', 'Lost', 'Project Creation'] },
          followUpDate: { $gte: startOfToday, $lte: endOfToday }
        }).select('projectName clientName followUpDate status');

        return { overdueCount: overdue.length, dueTodayCount: dueToday.length, overdue, dueToday };
      })(),

      // 5. Revenue Forecast
      Enquiry.aggregate([
        { $match: { status: { $nin: ['Won', 'Lost', 'Project Creation'] } } },
        { $group: { _id: null, forecastSum: { $sum: '$estimatedValue' } } }
      ]),

      // 6. Proposal / Negotiation Status Pipeline Enquiries
      Enquiry.find({ status: { $in: ['Proposal', 'Negotiation'] } })
        .select('projectName clientName estimatedValue status followUpDate')
        .sort({ estimatedValue: -1 })
    ]);

    const newEnquiriesCount = unpackSettled(newEnquiriesRes, 0);
    const pipelineData = unpackSettled(pipelineReportRes, []);
    const conversionData = unpackSettled(conversionReportRes, { totalClosed: 0, wonCount: 0, conversionRatePercentage: 0 });
    const followUpData = unpackSettled(followUpReportRes, { overdueCount: 0, dueTodayCount: 0, overdue: [], dueToday: [] });
    
    const forecastRaw = unpackSettled(revenueForecastRes, []);
    const forecastValue = forecastRaw && forecastRaw[0] ? Number(forecastRaw[0].forecastSum.toFixed(2)) : 0;

    const proposalEnquiries = unpackSettled(proposalEnquiriesRes, []);

    return res.json({
      role: req.user?.role?.name || 'Business Development Manager',
      dateFormat: 'DD/MM/YYYY',
      kpis: {
        newEnquiriesLast30DaysCount: newEnquiriesCount,
        pipelineBreakdown: pipelineData,
        conversionRate: conversionData,
        followUpReminders: {
          overdueCount: followUpData.overdueCount,
          dueTodayCount: followUpData.dueTodayCount,
          overdueEnquiries: followUpData.overdue.map(e => ({ ...e.toObject(), followUpDateFormatted: formatDDMMYYYY(e.followUpDate) })),
          dueTodayEnquiries: followUpData.dueToday.map(e => ({ ...e.toObject(), followUpDateFormatted: formatDDMMYYYY(e.followUpDate) }))
        },
        revenueForecastTotalEstimatedValue: forecastValue,
        activeProposalsCount: proposalEnquiries.length,
        activeProposals: proposalEnquiries.map(p => ({
          enquiryId: p._id,
          projectName: p.projectName,
          clientName: p.clientName,
          estimatedValue: p.estimatedValue,
          status: p.status,
          followUpDateFormatted: formatDDMMYYYY(p.followUpDate)
        }))
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// CONVENIENCE ROUTING SUMMARY ENDPOINT
// ============================================================

// @desc    Auto-detect user role and return role-matched dashboard
// @route   GET /api/dashboard/summary
// @access  Private (Authenticated Users)
const getDashboardSummary = async (req, res) => {
  const roleName = req.user?.role?.name;

  if (roleName === 'Director') {
    return getDirectorDashboard(req, res);
  } else if (roleName === 'Production Manager') {
    return getPMDashboard(req, res);
  } else if (roleName === 'Artist') {
    return getArtistDashboard(req, res);
  } else if (roleName === 'Human Resource') {
    return getHRDashboard(req, res);
  } else if (roleName === 'Business Development Manager') {
    return getBDDashboard(req, res);
  }

  // Fallback for custom roles: match by highest permission flag
  const p = req.user?.role?.permissions;
  if (p?.systemConfiguration) return getDirectorDashboard(req, res);
  if (p?.projectManagement) return getPMDashboard(req, res);
  if (p?.hrAccess) return getHRDashboard(req, res);
  if (p?.businessDevAccess) return getBDDashboard(req, res);

  return getArtistDashboard(req, res);
};

module.exports = {
  getDirectorDashboard,
  getPMDashboard,
  getArtistDashboard,
  getHRDashboard,
  getBDDashboard,
  getDashboardSummary
};
