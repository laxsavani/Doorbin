const Task = require('../models/Task');
const Stage = require('../models/Stage');
const Project = require('../models/Project');
const Holiday = require('../models/Holiday');

/**
 * Calculates working days between two dates excluding weekends (Sat/Sun) and optional holidays.
 */
async function calculateWorkingDays(startDate, endDate, holidaysList = null) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) return 0;

  if (!holidaysList) {
    const holidays = await Holiday.find({ date: { $gte: start, $lte: end } });
    holidaysList = holidays.map(h => new Date(h.date).toISOString().split('T')[0]);
  }

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dayOfWeek = cur.getDay(); // 0: Sun, 6: Sat
    const dateStr = cur.toISOString().split('T')[0];
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isHoliday = holidaysList.includes(dateStr);

    if (!isWeekend && !isHoliday) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Calculates stage completion percentage based on child tasks.
 */
async function calculateStageProgress(stageId) {
  if (!stageId) return 0;
  const tasks = await Task.find({ stage: stageId });
  if (!tasks.length) return 0;

  const completedCount = tasks.filter(t => t.status === 'Completed' || t.status === 'Approved').length;
  const percentage = Math.round((completedCount / tasks.length) * 100);

  await Stage.findByIdAndUpdate(stageId, { completionPercent: percentage });
  return percentage;
}

/**
 * Calculates overall project progress percentage based on all stages and tasks.
 */
async function calculateProjectProgress(projectId) {
  if (!projectId) return 0;
  const stages = await Stage.find({ project: projectId });
  if (!stages.length) {
    // If no stages, check tasks directly
    const tasks = await Task.find({ project: projectId });
    if (!tasks.length) return 0;
    const completedCount = tasks.filter(t => t.status === 'Completed' || t.status === 'Approved').length;
    const pct = Math.round((completedCount / tasks.length) * 100);
    await Project.findByIdAndUpdate(projectId, { progressPercentage: pct, progressPercent: pct });
    return pct;
  }

  let totalStagePct = 0;
  for (const s of stages) {
    const stagePct = await calculateStageProgress(s._id);
    totalStagePct += stagePct;
  }

  const overallPct = Math.round(totalStagePct / stages.length);
  await Project.findByIdAndUpdate(projectId, { progressPercentage: overallPct, progressPercent: overallPct });
  return overallPct;
}

/**
 * Checks if a task is delayed.
 */
function checkTaskDelay(task) {
  if (!task || !task.endDate) return false;
  const isDone = (task.status === 'Completed' || task.status === 'Approved');
  if (isDone) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(task.endDate);
  end.setHours(0, 0, 0, 0);
  return end < today;
}

/**
 * Calculates timeline variance in days between planned duration and actual duration.
 */
function calculateTimelineVariance(plannedStart, plannedEnd, actualStart, actualEnd) {
  if (!plannedStart || !plannedEnd) return 0;
  const plannedMs = new Date(plannedEnd).getTime() - new Date(plannedStart).getTime();
  const plannedDays = Math.ceil(plannedMs / (1000 * 60 * 60 * 24));

  const actStart = actualStart ? new Date(actualStart) : new Date(plannedStart);
  const actEnd = actualEnd ? new Date(actualEnd) : new Date();
  const actualMs = actEnd.getTime() - actStart.getTime();
  const actualDays = Math.ceil(actualMs / (1000 * 60 * 60 * 24));

  return actualDays - plannedDays;
}

/**
 * Calculates Critical Path Method (CPM) for a given list of tasks with dependencies.
 */
function calculateCriticalPath(tasks) {
  if (!tasks || !tasks.length) return { criticalPath: [], taskDetails: [] };

  const taskMap = new Map();
  tasks.forEach(t => {
    const idStr = t._id.toString();
    const duration = t.estimatedHours ? Math.ceil(t.estimatedHours / 8) : 1; // convert to days
    taskMap.set(idStr, {
      id: idStr,
      taskName: t.taskName,
      duration: Math.max(1, duration),
      dependencies: (t.dependencies || []).map(d => d._id ? d._id.toString() : d.toString()),
      earliestStart: 0,
      earliestFinish: 0,
      latestStart: Infinity,
      latestFinish: Infinity,
      slack: 0,
      isCritical: false
    });
  });

  // Forward Pass
  const nodeIds = Array.from(taskMap.keys());
  let changed = true;
  while (changed) {
    changed = false;
    nodeIds.forEach(id => {
      const node = taskMap.get(id);
      let maxDepFinish = 0;
      node.dependencies.forEach(depId => {
        const depNode = taskMap.get(depId);
        if (depNode && depNode.earliestFinish > maxDepFinish) {
          maxDepFinish = depNode.earliestFinish;
        }
      });
      const newES = maxDepFinish;
      const newEF = newES + node.duration;
      if (newES !== node.earliestStart || newEF !== node.earliestFinish) {
        node.earliestStart = newES;
        node.earliestFinish = newEF;
        changed = true;
      }
    });
  }

  // Max finish time of all tasks
  let projectDuration = 0;
  nodeIds.forEach(id => {
    const node = taskMap.get(id);
    if (node.earliestFinish > projectDuration) {
      projectDuration = node.earliestFinish;
    }
  });

  // Backward Pass
  nodeIds.forEach(id => {
    const node = taskMap.get(id);
    // Find if this node is a dependency for any other node
    const isPredecessorOf = nodeIds.filter(otherId => {
      const other = taskMap.get(otherId);
      return other.dependencies.includes(id);
    });

    if (isPredecessorOf.length === 0) {
      node.latestFinish = projectDuration;
    } else {
      let minNextLS = Infinity;
      isPredecessorOf.forEach(nextId => {
        const nextNode = taskMap.get(nextId);
        if (nextNode.latestStart < minNextLS) {
          minNextLS = nextNode.latestStart;
        }
      });
      node.latestFinish = minNextLS;
    }
    node.latestStart = node.latestFinish - node.duration;
    node.slack = node.latestStart - node.earliestStart;
    node.isCritical = (node.slack === 0);
  });

  const taskDetails = Array.from(taskMap.values());
  const criticalPath = taskDetails.filter(t => t.isCritical).map(t => t.id);

  return {
    projectDurationDays: projectDuration,
    criticalPath,
    taskDetails
  };
}

module.exports = {
  calculateWorkingDays,
  calculateStageProgress,
  calculateProjectProgress,
  checkTaskDelay,
  calculateTimelineVariance,
  calculateCriticalPath
};
