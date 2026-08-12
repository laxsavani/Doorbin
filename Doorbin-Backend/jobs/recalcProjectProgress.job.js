const cron = require('node-cron');
const Project = require('../models/Project');
const { calculateProjectProgress } = require('../utils/autoCalcEngine');

/**
 * Runs daily at 01:00 AM to recalculate project progress and delays.
 */
function initRecalcProjectProgressJob() {
  cron.schedule('0 1 * * *', async () => {
    try {
      console.log('[Cron Job] Starting daily project progress & delay recalculation...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activeProjects = await Project.find({
        status: { $nin: ['completed', 'Completed', 'cancelled', 'Cancelled', 'rejected', 'Rejected'] }
      });

      for (const proj of activeProjects) {
        const newPct = await calculateProjectProgress(proj._id);
        const isDelayed = proj.endDate && new Date(proj.endDate) < today && newPct < 100;
        await Project.findByIdAndUpdate(proj._id, {
          progressPercentage: newPct,
          progressPercent: newPct,
          isDelayed: !!isDelayed
        });
      }

      console.log(`[Cron Job] Recalculated progress for ${activeProjects.length} active projects.`);
    } catch (error) {
      console.error('[Cron Job Error] recalcProjectProgress.job:', error.message);
    }
  });
}

module.exports = initRecalcProjectProgressJob;
