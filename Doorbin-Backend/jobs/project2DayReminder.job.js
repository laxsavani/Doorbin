const cron = require('node-cron');
const Project = require('../models/Project');
const User = require('../models/User');
const Role = require('../models/Role');
const Notification = require('../models/Notification');
const { formatDDMMYYYY } = require('../utils/dateFormatter');

/**
 * Runs daily at 09:00 AM to send reminders 2 days before Project Start Date and End Date.
 */
function initProject2DayReminderJob() {
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('[Cron Job] Starting 2-day project start/end date reminder job...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + 2);

      const nextDay = new Date(targetDate);
      nextDay.setHours(23, 59, 59, 999);

      const projectsStartingSoon = await Project.find({
        status: { $nin: ['Completed', 'Cancelled', 'completed', 'cancelled'] },
        isDeleted: { $ne: true },
        startDate: { $gte: targetDate, $lte: nextDay }
      }).populate('productionManager');

      const projectsEndingSoon = await Project.find({
        status: { $nin: ['Completed', 'Cancelled', 'completed', 'cancelled'] },
        isDeleted: { $ne: true },
        endDate: { $gte: targetDate, $lte: nextDay }
      }).populate('productionManager');

      const dirRole = await Role.findOne({ name: 'Director' });
      const directors = await User.find({ role: dirRole?._id, status: 'Active' });

      // Remind Starting Projects
      for (const proj of projectsStartingSoon) {
        const msg = `PROJECT STARTING SOON: Project "${proj.projectName}" starts in 2 days on ${formatDDMMYYYY(proj.startDate)}.`;
        const recipients = new Set();
        if (proj.productionManager?._id) recipients.add(proj.productionManager._id.toString());
        directors.forEach(d => recipients.add(d._id.toString()));

        for (const userId of recipients) {
          await Notification.create({
            user: userId,
            title: 'Project Start Reminder (2 Days)',
            message: msg,
            type: 'PROJECT',
            refId: proj._id
          });
        }
      }

      // Remind Ending Projects
      for (const proj of projectsEndingSoon) {
        const msg = `PROJECT ENDING SOON: Project "${proj.projectName}" end date is in 2 days on ${formatDDMMYYYY(proj.endDate)}.`;
        const recipients = new Set();
        if (proj.productionManager?._id) recipients.add(proj.productionManager._id.toString());
        directors.forEach(d => recipients.add(d._id.toString()));

        for (const userId of recipients) {
          await Notification.create({
            user: userId,
            title: 'Project End Date Reminder (2 Days)',
            message: msg,
            type: 'PROJECT',
            refId: proj._id
          });
        }
      }

      console.log(`[Cron Job] Sent reminders for ${projectsStartingSoon.length} starting projects & ${projectsEndingSoon.length} ending projects.`);
    } catch (error) {
      console.error('[Cron Job Error] project2DayReminder.job:', error.message);
    }
  });
}

module.exports = initProject2DayReminderJob;
