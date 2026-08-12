const cron = require('node-cron');
const Task = require('../models/Task');

/**
 * Runs daily at 00:30 AM to check for task delays.
 */
function initRecalcTaskDelayJob() {
  cron.schedule('30 0 * * *', async () => {
    try {
      console.log('[Cron Job] Starting daily task delay recalculation job...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pendingTasks = await Task.find({
        status: { $nin: ['Completed', 'Approved', 'Cancelled'] },
        endDate: { $lt: today }
      });

      let updatedCount = 0;
      for (const task of pendingTasks) {
        task.isDelayed = true;
        await task.save();
        updatedCount++;
      }

      console.log(`[Cron Job] Task delay recalculation complete. Flagged ${updatedCount} delayed tasks.`);
    } catch (error) {
      console.error('[Cron Job Error] recalcTaskDelay.job:', error.message);
    }
  });
}

module.exports = initRecalcTaskDelayJob;
