const Task = require('../models/Task');
const Stage = require('../models/Stage');
const Project = require('../models/Project');
const RescheduleLog = require('../models/RescheduleLog');
const Enquiry = require('../models/Enquiry');
const Holiday = require('../models/Holiday');
const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');
const logActivity = require('../utils/activityLogger');
const { formatDDMMYYYY, parseDateString, calculateWorkingDays } = require('../utils/dateFormatter');
const mongoose = require('mongoose');

// Helper: Check if caller is PM or Director
const isPMOrDirector = (req) => {
  return req.user?.role?.name === 'Director' ||
    req.user?.role?.permissions?.projectManagement === true ||
    req.user?.role?.permissions?.userManagement === true;
};

// @desc    Get interactive Gantt Chart data for a project
// @route   GET /api/timeline/project/:id
// @access  Private (Authenticated users)
const getProjectGanttChart = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
      .populate('client', 'companyName clientName')
      .populate('productionManager', 'name email');

    if (!project) {
      return res.status(404).json({ message: 'Project not found or deleted' });
    }

    const stages = await Stage.find({ project: req.params.id }).sort({ order: 1 });
    const tasks = await Task.find({ project: req.params.id })
      .populate('assignee', 'name email')
      .populate('reviewer', 'name email')
      .populate('stage', 'stageName')
      .populate('subStage', 'name');

    const now = new Date();

    const tasksByStage = {};
    tasks.forEach(t => {
      const stageIdStr = t.stage._id.toString();
      if (!tasksByStage[stageIdStr]) tasksByStage[stageIdStr] = [];

      const isOverdue = t.endDate && t.endDate < now && !['Completed', 'Approved'].includes(t.status);

      tasksByStage[stageIdStr].push({
        taskId: t._id,
        taskName: t.taskName,
        parentTask: t.parentTask,
        assignee: t.assignee,
        reviewer: t.reviewer,
        subStage: t.subStage,
        priority: t.priority,
        status: t.status,
        startDateFormatted: formatDDMMYYYY(t.startDate),
        endDateFormatted: formatDDMMYYYY(t.endDate),
        startDate: t.startDate,
        endDate: t.endDate,
        estimatedHours: t.estimatedHours,
        actualHours: t.actualHours,
        workingDays: t.workingDays,
        dependencies: t.dependencies,
        isOverdue
      });
    });

    const assembledStages = stages.map(s => {
      const stageTasks = tasksByStage[s._id.toString()] || [];

      let stageMinStart = null;
      let stageMaxEnd = null;

      stageTasks.forEach(t => {
        if (t.startDate) {
          const stDate = new Date(t.startDate);
          if (!stageMinStart || stDate < stageMinStart) stageMinStart = stDate;
        }
        if (t.endDate) {
          const enDate = new Date(t.endDate);
          if (!stageMaxEnd || enDate > stageMaxEnd) stageMaxEnd = enDate;
        }
      });

      return {
        stageId: s._id,
        stageName: s.stageName,
        order: s.order,
        approvalRequired: s.approvalRequired,
        milestone: s.approvalRequired === true,
        approvedBy: s.approvedBy,
        approvedAtFormatted: formatDDMMYYYY(s.approvedAt),
        approvedAt: s.approvedAt,
        status: s.status,
        completionPercentage: s.completionPercentage,
        dependsOn: s.dependsOn,
        subStages: s.subStages,
        derivedStartDateFormatted: formatDDMMYYYY(stageMinStart),
        derivedEndDateFormatted: formatDDMMYYYY(stageMaxEnd),
        derivedStartDate: stageMinStart,
        derivedEndDate: stageMaxEnd,
        tasks: stageTasks
      };
    });

    return res.json({
      project: {
        projectId: project._id,
        projectName: project.projectName,
        projectCategory: project.projectCategory,
        projectSubType: project.projectSubType,
        client: project.client,
        productionManager: project.productionManager,
        startDateFormatted: formatDDMMYYYY(project.startDate),
        endDateFormatted: formatDDMMYYYY(project.endDate),
        startDate: project.startDate,
        endDate: project.endDate,
        status: project.status,
        progressPercentage: project.progressPercentage
      },
      dateFormat: 'DD/MM/YYYY',
      totalStagesCount: assembledStages.length,
      totalTasksCount: tasks.length,
      stages: assembledStages
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Calculate Critical Path Method (CPM)
// @route   GET /api/timeline/critical-path/:projectId
// @access  Private (PM / Director)
const getCriticalPath = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findOne({ _id: projectId, isDeleted: { $ne: true } });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or deleted' });
    }

    const tasks = await Task.find({ project: projectId }).select('taskName startDate endDate workingDays estimatedHours dependencies status stage');

    if (tasks.length === 0) {
      return res.json({
        projectId,
        criticalPathTasks: [],
        totalMinimumWorkingDays: 0,
        message: 'No tasks found for this project'
      });
    }

    const taskMap = {};
    const adjList = {};
    const inDegree = {};

    tasks.forEach(t => {
      const idStr = t._id.toString();
      taskMap[idStr] = {
        taskId: t._id,
        taskName: t.taskName,
        workingDays: t.workingDays || calculateWorkingDays(t.startDate, t.endDate) || 1,
        dependencies: (t.dependencies || []).map(d => d.toString()),
        status: t.status,
        earliestStart: 0,
        earliestFinish: 0,
        latestStart: Infinity,
        latestFinish: Infinity,
        slack: 0
      };
      adjList[idStr] = [];
      inDegree[idStr] = 0;
    });

    tasks.forEach(t => {
      const idStr = t._id.toString();
      (t.dependencies || []).forEach(depId => {
        const depStr = depId.toString();
        if (adjList[depStr]) {
          adjList[depStr].push(idStr);
          inDegree[idStr] = (inDegree[idStr] || 0) + 1;
        }
      });
    });

    const topoOrder = [];
    const queue = [];

    Object.keys(inDegree).forEach(idStr => {
      if (inDegree[idStr] === 0) queue.push(idStr);
    });

    while (queue.length > 0) {
      const u = queue.shift();
      topoOrder.push(u);

      const uNode = taskMap[u];
      uNode.earliestFinish = uNode.earliestStart + uNode.workingDays;

      (adjList[u] || []).forEach(v => {
        const vNode = taskMap[v];
        if (uNode.earliestFinish > vNode.earliestStart) {
          vNode.earliestStart = uNode.earliestFinish;
        }
        inDegree[v]--;
        if (inDegree[v] === 0) queue.push(v);
      });
    }

    if (topoOrder.length !== tasks.length) {
      return res.status(400).json({ message: 'Circular dependency detected among project tasks. Cannot compute critical path.' });
    }

    let maxProjectDuration = 0;
    Object.values(taskMap).forEach(node => {
      if (node.earliestFinish > maxProjectDuration) {
        maxProjectDuration = node.earliestFinish;
      }
    });

    Object.values(taskMap).forEach(node => {
      if ((adjList[node.taskId.toString()] || []).length === 0) {
        node.latestFinish = maxProjectDuration;
        node.latestStart = node.latestFinish - node.workingDays;
      }
    });

    for (let i = topoOrder.length - 1; i >= 0; i--) {
      const u = topoOrder[i];
      const uNode = taskMap[u];

      (adjList[u] || []).forEach(v => {
        const vNode = taskMap[v];
        if (vNode.latestStart < uNode.latestFinish) {
          uNode.latestFinish = vNode.latestStart;
        }
      });
      uNode.latestStart = uNode.latestFinish - uNode.workingDays;
      uNode.slack = uNode.latestStart - uNode.earliestStart;
    }

    const criticalPathNodes = Object.values(taskMap)
      .filter(n => n.slack === 0)
      .sort((a, b) => a.earliestStart - b.earliestStart);

    return res.json({
      projectId,
      projectName: project.projectName,
      totalMinimumWorkingDays: maxProjectDuration,
      criticalPathCount: criticalPathNodes.length,
      criticalPath: criticalPathNodes.map(n => ({
        taskId: n.taskId,
        taskName: n.taskName,
        workingDays: n.workingDays,
        earliestStartDay: n.earliestStart,
        earliestFinishDay: n.earliestFinish,
        slack: n.slack,
        status: n.status
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Planned vs Actual Duration Comparison Report
// @route   GET /api/timeline/planned-vs-actual/:projectId
// @access  Private (PM / Director)
const getPlannedVsActual = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findOne({ _id: projectId, isDeleted: { $ne: true } });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or deleted' });
    }

    const stages = await Stage.find({ project: projectId }).sort({ order: 1 });
    const tasks = await Task.find({ project: projectId }).select('taskName stage status workingDays estimatedHours actualHours auditHistory startDate endDate');

    const tasksByStage = {};
    tasks.forEach(t => {
      const sId = t.stage.toString();
      if (!tasksByStage[sId]) tasksByStage[sId] = [];
      tasksByStage[sId].push(t);
    });

    let projectPlannedDays = 0;
    let projectActualDays = 0;

    const stageComparison = stages.map(s => {
      const sTasks = tasksByStage[s._id.toString()] || [];

      let stagePlannedDays = 0;
      let stageActualDays = 0;

      const taskDetails = sTasks.map(t => {
        const plannedDays = t.workingDays || calculateWorkingDays(t.startDate, t.endDate) || 0;
        stagePlannedDays += plannedDays;

        let actualDays = 0;
        if (t.actualHours) {
          actualDays = Number((t.actualHours / 8).toFixed(1));
        } else if (t.auditHistory && t.auditHistory.length > 0) {
          const inProgEntry = t.auditHistory.find(h => h.newValue === 'In Progress');
          const compEntry = t.auditHistory.find(h => ['Completed', 'Approved'].includes(h.newValue));

          if (inProgEntry && compEntry) {
            actualDays = calculateWorkingDays(inProgEntry.date, compEntry.date);
          } else {
            actualDays = plannedDays;
          }
        } else if (['Completed', 'Approved'].includes(t.status)) {
          actualDays = plannedDays;
        }

        stageActualDays += actualDays;

        const varianceDays = Number((actualDays - plannedDays).toFixed(1));

        return {
          taskId: t._id,
          taskName: t.taskName,
          status: t.status,
          plannedWorkingDays: plannedDays,
          actualExecutionDays: actualDays,
          varianceDays,
          varianceStatus: varianceDays > 0 ? 'Delayed' : varianceDays < 0 ? 'Ahead' : 'On Track'
        };
      });

      projectPlannedDays += stagePlannedDays;
      projectActualDays += stageActualDays;

      const stageVariance = Number((stageActualDays - stagePlannedDays).toFixed(1));

      return {
        stageId: s._id,
        stageName: s.stageName,
        status: s.status,
        stagePlannedDays,
        stageActualDays,
        stageVarianceDays: stageVariance,
        varianceStatus: stageVariance > 0 ? 'Behind Schedule' : stageVariance < 0 ? 'Ahead of Schedule' : 'On Schedule',
        tasks: taskDetails
      };
    });

    const projectVarianceDays = Number((projectActualDays - projectPlannedDays).toFixed(1));

    return res.json({
      projectId,
      projectName: project.projectName,
      dateFormat: 'DD/MM/YYYY',
      projectPlannedDays,
      projectActualDays,
      projectVarianceDays,
      overallStatus: projectVarianceDays > 0 ? 'Behind Schedule' : projectVarianceDays < 0 ? 'Ahead of Schedule' : 'On Schedule',
      stages: stageComparison
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Drag-and-Drop Task Rescheduling with Recursive Cascading
// @route   PUT /api/timeline/task/:id/reschedule
// @access  Private (PM / Director)
const rescheduleTask = async (req, res) => {
  if (!isPMOrDirector(req)) {
    return res.status(403).json({ message: 'Access denied. PM or Director role required for rescheduling tasks.' });
  }

  const { id } = req.params;
  const { startDate, endDate, cascade, reason } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'New startDate and endDate are required' });
  }

  const parsedNewStart = parseDateString(startDate);
  const parsedNewEnd = parseDateString(endDate, true);

  if (!parsedNewStart || !parsedNewEnd || parsedNewStart > parsedNewEnd) {
    return res.status(400).json({ message: 'Invalid start or end date' });
  }

  try {
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const oldStart = task.startDate;
    const oldEnd = task.endDate;

    const deltaMs = parsedNewStart.getTime() - new Date(oldStart).getTime();
    const shouldCascade = cascade === true || cascade === 'true';

    const conflicts = [];
    if (!shouldCascade) {
      const dependentTasks = await Task.find({ dependencies: id });
      dependentTasks.forEach(dep => {
        if (new Date(dep.startDate) < parsedNewEnd) {
          conflicts.push({
            conflictingTaskId: dep._id,
            conflictingTaskName: dep.taskName,
            currentStartDateFormatted: formatDDMMYYYY(dep.startDate),
            currentStartDate: dep.startDate,
            requiredMinStartDateFormatted: formatDDMMYYYY(parsedNewEnd),
            requiredMinStartDate: parsedNewEnd
          });
        }
      });

      if (conflicts.length > 0) {
        return res.status(409).json({
          message: 'Rescheduling creates dependency conflicts. Enable cascade: true to shift downstream tasks automatically.',
          conflicts
        });
      }
    }

    task.startDate = parsedNewStart;
    task.endDate = parsedNewEnd;
    task.workingDays = await calculateWorkingDays(parsedNewStart, parsedNewEnd);
    await task.save();

    const cascadedTaskIds = [];

    if (shouldCascade && deltaMs !== 0) {
      const visited = new Set([id]);
      const queue = [id];
      let iterations = 0;

      while (queue.length > 0 && iterations < 50) {
        iterations++;
        const currentTaskId = queue.shift();
        const currentTaskObj = await Task.findById(currentTaskId);
        if (!currentTaskObj) continue;

        const dependents = await Task.find({ dependencies: currentTaskId });

        for (const depTask of dependents) {
          const depIdStr = depTask._id.toString();
          if (!visited.has(depIdStr)) {
            visited.add(depIdStr);

            const depOldStart = new Date(depTask.startDate).getTime();
            const depOldEnd = new Date(depTask.endDate).getTime();
            const depNewStart = new Date(depOldStart + deltaMs);
            const depNewEnd = new Date(depOldEnd + deltaMs);

            depTask.startDate = depNewStart;
            depTask.endDate = depNewEnd;
            depTask.workingDays = await calculateWorkingDays(depNewStart, depNewEnd);
            await depTask.save();

            cascadedTaskIds.push(depTask._id);
            queue.push(depIdStr);
          }
        }
      }
    }

    const logEntry = await RescheduleLog.create({
      task: task._id,
      project: task.project,
      oldStartDate: oldStart,
      oldEndDate: oldEnd,
      newStartDate: parsedNewStart,
      newEndDate: parsedNewEnd,
      cascaded: shouldCascade,
      cascadedTasks: cascadedTaskIds,
      rescheduledBy: req.user._id,
      reason: reason ? String(reason).trim() : 'Drag-and-drop timeline adjustment'
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'TASK_RESCHEDULED',
      targetType: 'Task',
      targetId: task._id,
      metadata: { project: task.project, cascadedCount: cascadedTaskIds.length, reason: logEntry.reason }
    });

    return res.json({
      message: 'Task rescheduled successfully',
      rescheduledTask: {
        taskId: task._id,
        taskName: task.taskName,
        oldStartDateFormatted: formatDDMMYYYY(oldStart),
        oldEndDateFormatted: formatDDMMYYYY(oldEnd),
        newStartDateFormatted: formatDDMMYYYY(parsedNewStart),
        newEndDateFormatted: formatDDMMYYYY(parsedNewEnd),
        workingDays: task.workingDays
      },
      cascaded: shouldCascade,
      cascadedTasksCount: cascadedTaskIds.length,
      cascadedTasks: cascadedTaskIds
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Reschedule History for a Project
// @route   GET /api/timeline/reschedule-history/:projectId
// @access  Private (PM / Director)
const getRescheduleHistory = async (req, res) => {
  try {
    const { projectId } = req.params;

    const logs = await RescheduleLog.find({ project: projectId })
      .populate('task', 'taskName')
      .populate('rescheduledBy', 'name email')
      .populate('cascadedTasks', 'taskName')
      .sort({ createdAt: -1 });

    const formattedLogs = logs.map(l => ({
      _id: l._id,
      task: l.task,
      oldStartDateFormatted: formatDDMMYYYY(l.oldStartDate),
      oldEndDateFormatted: formatDDMMYYYY(l.oldEndDate),
      newStartDateFormatted: formatDDMMYYYY(l.newStartDate),
      newEndDateFormatted: formatDDMMYYYY(l.newEndDate),
      cascaded: l.cascaded,
      cascadedTasks: l.cascadedTasks,
      rescheduledBy: l.rescheduledBy,
      reason: l.reason,
      createdAtFormatted: formatDDMMYYYY(l.createdAt),
      createdAt: l.createdAt
    }));

    return res.json({
      projectId,
      totalRescheduleLogsCount: logs.length,
      dateFormat: 'DD/MM/YYYY',
      rescheduleHistory: formattedLogs
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Studio-Wide Calendar (Monthly/Weekly/Daily)
// @route   GET /api/calendar
// @access  Private (Authenticated users)
const getStudioCalendar = async (req, res) => {
  try {
    const { view = 'month', date } = req.query;

    const baseDate = date ? parseDateString(date) : new Date();
    if (!baseDate) return res.status(400).json({ message: 'Invalid base date provided' });

    let fromDate;
    let toDate;

    if (view === 'day') {
      fromDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0);
      toDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 23, 59, 59);
    } else if (view === 'week') {
      const dayOfWeek = baseDate.getDay();
      const distanceToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      fromDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + distanceToMon, 0, 0, 0);
      toDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + 6, 23, 59, 59);
    } else {
      fromDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1, 0, 0, 0);
      toDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59);
    }

    const projectQuery = { isDeleted: { $ne: true } };
    const userRole = req.user?.role?.name;

    if (userRole === 'Artist') {
      projectQuery.$or = [
        { productionManager: req.user._id },
        { assignedTeam: req.user._id }
      ];
    }

    const visibleProjects = await Project.find(projectQuery).select('_id projectName projectCategory status');
    const projectIds = visibleProjects.map(p => p._id);

    const tasks = await Task.find({
      project: { $in: projectIds },
      startDate: { $lte: toDate },
      endDate: { $gte: fromDate }
    })
      .populate('project', 'projectName projectCategory')
      .populate('assignee', 'name email')
      .populate('reviewer', 'name email')
      .populate('stage', 'stageName');

    // 1. Tasks
    const calendarEvents = tasks.map(t => ({
      id: `task_${t._id}`,
      taskId: t._id,
      title: t.taskName,
      type: 'Task',
      project: t.project?.projectName || 'General Task',
      stage: t.stage?.stageName,
      assignedTo: t.assignee?.name || 'Unassigned',
      assignee: t.assignee,
      reviewer: t.reviewer,
      status: t.status,
      priority: t.priority,
      startDateFormatted: formatDDMMYYYY(t.startDate),
      endDateFormatted: formatDDMMYYYY(t.endDate),
      startDate: t.startDate,
      endDate: t.endDate,
      dateStr: (() => {
        const d = t.endDate ? new Date(t.endDate) : (t.startDate ? new Date(t.startDate) : new Date());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })(),
      time: '05:00 PM'
    }));

    // 2. Project Milestones
    const milestoneEvents = visibleProjects
      .filter(p => p.endDate && new Date(p.endDate) >= fromDate && new Date(p.endDate) <= toDate)
      .map(p => ({
        id: `proj_${p._id}`,
        projectId: p._id,
        title: `${p.projectName} Milestone Target`,
        type: 'Milestone',
        project: p.projectName,
        assignedTo: 'PM Team',
        status: p.status,
        dateStr: new Date(p.endDate).toISOString().split('T')[0],
        time: '11:00 AM'
      }));

    let holidaysList = [];
    let leavesList = [];
    let crmEvents = [];

    // 3. CRM Meetings & Follow-ups
    const enquiries = await Enquiry.find({
      followUpDate: { $gte: fromDate, $lte: toDate }
    }).populate('assignedExecutive', 'name email');

    crmEvents = enquiries.map(e => ({
      id: `crm_${e._id}`,
      enquiryId: e._id,
      title: `${e.status === 'Meeting' ? 'Meeting' : 'Followup'}: ${e.projectName} (${e.clientName})`,
      type: e.status === 'Meeting' ? 'Meeting' : 'Followup',
      project: e.projectName,
      assignedTo: e.assignedExecutive?.name || 'BD Team',
      status: e.status,
      dateStr: e.followUpDate ? new Date(e.followUpDate).toISOString().split('T')[0] : null,
      time: '02:00 PM'
    }));

    // 4. Holidays
    const hDocs = await Holiday.find({
      date: { $gte: fromDate, $lte: toDate }
    }).sort({ date: 1 });

    holidaysList = hDocs.map(h => {
      const d = new Date(h.date);
      const yearStr = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const localDateStr = `${yearStr}-${monthStr}-${dayStr}`;

      return {
        id: `hol_${h._id}`,
        holidayId: h._id,
        title: `Holiday: ${h.name}`,
        name: h.name,
        type: 'Holiday',
        category: h.type || h.category || 'Festival',
        project: 'Studio Holiday',
        dateFormatted: formatDDMMYYYY(h.date),
        date: h.date,
        dateStr: localDateStr
      };
    });

    // 5. Approved / Pending Leaves & Attendance On-Leave Logs (Studio Wide for All Roles)
    const leaveQuery = {
      status: { $in: ['Approved', 'Pending'] },
      fromDate: { $lte: toDate },
      toDate: { $gte: fromDate }
    };

    const lDocs = await Leave.find(leaveQuery)
      .populate('employee', 'name email department')
      .sort({ fromDate: 1 });

    const parseLocalDateOnly = (dateInput) => {
      if (!dateInput) return null;
      if (dateInput instanceof Date) {
        return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
      }
      const str = String(dateInput).split('T')[0];
      const parts = str.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
      const d = new Date(dateInput);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    leavesList = [];
    const uniqueLeaveKeys = new Set();

    lDocs.forEach(l => {
      const cur = parseLocalDateOnly(l.fromDate);
      const end = parseLocalDateOnly(l.toDate);
      if (!cur || !end) return;

      const fromBoundary = parseLocalDateOnly(fromDate);
      const toBoundary = parseLocalDateOnly(toDate);

      while (cur <= end) {
        if (cur >= fromBoundary && cur <= toBoundary) {
          const yearStr = cur.getFullYear();
          const monthStr = String(cur.getMonth() + 1).padStart(2, '0');
          const dayStr = String(cur.getDate()).padStart(2, '0');
          const localDateStr = `${yearStr}-${monthStr}-${dayStr}`;
          const empId = l.employee?._id ? l.employee._id.toString() : String(l.employee);
          const key = `${empId}_${localDateStr}`;

          if (!uniqueLeaveKeys.has(key)) {
            uniqueLeaveKeys.add(key);
            leavesList.push({
              id: `leave_${l._id}_${localDateStr}`,
              leaveId: l._id,
              title: `Leave: ${l.employee?.name || 'Staff'} (${l.leaveType})`,
              employee: l.employee,
              type: 'Leave',
              project: 'HR Leave',
              fromDateFormatted: formatDDMMYYYY(l.fromDate),
              toDateFormatted: formatDDMMYYYY(l.toDate),
              fromDate: l.fromDate,
              toDate: l.toDate,
              dateStr: localDateStr,
              date: localDateStr,
              reason: l.reason
            });
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    });

    // Also include Attendance records marked as 'On Leave' (Studio-wide)
    const attQuery = {
      status: new RegExp('leave', 'i'),
      date: { $gte: fromDate, $lte: toDate }
    };

    const attLeaveDocs = await Attendance.find(attQuery).populate('employee', 'name email department');
    attLeaveDocs.forEach(att => {
      const d = parseLocalDateOnly(att.date);
      if (!d) return;
      const yearStr = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const localDateStr = `${yearStr}-${monthStr}-${dayStr}`;
      const empId = att.employee?._id ? att.employee._id.toString() : String(att.employee);
      const key = `${empId}_${localDateStr}`;

      if (!uniqueLeaveKeys.has(key)) {
        uniqueLeaveKeys.add(key);
        leavesList.push({
          id: `att_leave_${att._id}_${localDateStr}`,
          title: `Leave: ${att.employee?.name || 'Staff'} (On Leave)`,
          employee: att.employee,
          type: 'Leave',
          project: 'HR Leave',
          dateFormatted: formatDDMMYYYY(att.date),
          date: localDateStr,
          dateStr: localDateStr,
          reason: 'On Leave'
        });
      }
    });

    // Unified events collection for frontend calendar aggregation
    const unifiedEvents = [
      ...calendarEvents,
      ...milestoneEvents,
      ...crmEvents,
      ...holidaysList,
      ...leavesList
    ];

    return res.json({
      view,
      dateFormat: 'DD/MM/YYYY',
      range: {
        fromFormatted: formatDDMMYYYY(fromDate),
        toFormatted: formatDDMMYYYY(toDate),
        from: fromDate,
        to: toDate
      },
      totalEventsCount: unifiedEvents.length,
      events: unifiedEvents,
      tasks: calendarEvents,
      milestones: milestoneEvents,
      crmEvents,
      holidays: holidaysList,
      leaves: leavesList
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProjectGanttChart,
  getCriticalPath,
  getPlannedVsActual,
  rescheduleTask,
  getRescheduleHistory,
  getStudioCalendar
};
