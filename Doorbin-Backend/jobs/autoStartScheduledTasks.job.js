const cron = require('node-cron');
const Project = require('../models/Project');
const Task = require('../models/Task');
const logActivity = require('../utils/activityLogger');

/**
 * Runs daily at 00:05 AM to auto-start Projects & Tasks whose startDate <= today.
 */
function initAutoStartScheduledTasksJob() {
  cron.schedule('5 0 * * *', async () => {
    try {
      console.log('[Cron Job] Starting auto-start for scheduled projects and tasks...');
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      // Auto-start Projects
      const pendingProjects = await Project.find({
        status: { $in: ['Not Started', 'pending_approval', 'Pending Approval'] },
        startDate: { $lte: today },
        isDeleted: { $ne: true }
      });

      for (const proj of pendingProjects) {
        proj.status = 'In Progress';
        await proj.save();
      }

      // Auto-start Tasks
      const pendingTasks = await Task.find({
        status: 'Pending',
        startDate: { $lte: today }
      });

      for (const task of pendingTasks) {
        task.status = task.assignee ? 'Assigned' : 'In Progress';
        task.auditHistory.push({
          field: 'status',
          oldValue: 'Pending',
          newValue: task.status,
          date: new Date()
        });
        await task.save();
      }

      console.log(`[Cron Job] Auto-started ${pendingProjects.length} projects & ${pendingTasks.length} tasks.`);
    } catch (error) {
      console.error('[Cron Job Error] autoStartScheduledTasks.job:', error.message);
    }
  });
}

module.exports = initAutoStartScheduledTasksJob;
