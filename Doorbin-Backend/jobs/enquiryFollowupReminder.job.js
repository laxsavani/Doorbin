const cron = require('node-cron');
const Enquiry = require('../models/Enquiry');
const Notification = require('../models/Notification');

/**
 * Runs daily at 09:00 AM to send follow-up reminders for CRM enquiries.
 */
function initEnquiryFollowupReminderJob() {
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('[Cron Job] Starting daily CRM enquiry follow-up reminder job...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const pendingEnquiries = await Enquiry.find({
        status: { $nin: ['Won', 'Lost', 'won', 'lost'] },
        followUpDate: { $lte: endOfDay }
      });

      for (const enq of pendingEnquiries) {
        if (enq.assignedExecutive) {
          const isOverdue = enq.followUpDate && new Date(enq.followUpDate) < today;
          const msg = isOverdue
            ? `OVERDUE FOLLOW-UP: Enquiry "${enq.projectName || enq.clientName}" follow-up was scheduled for ${new Date(enq.followUpDate).toLocaleDateString()}.`
            : `FOLLOW-UP TODAY: Enquiry "${enq.projectName || enq.clientName}" requires follow-up today.`;

          await Notification.create({
            user: enq.assignedExecutive,
            title: isOverdue ? 'Overdue CRM Follow-up' : 'CRM Follow-up Reminder',
            message: msg,
            type: 'CRM',
            refId: enq._id
          });
        }
      }

      console.log(`[Cron Job] CRM follow-up reminders sent for ${pendingEnquiries.length} enquiries.`);
    } catch (error) {
      console.error('[Cron Job Error] enquiryFollowupReminder.job:', error.message);
    }
  });
}

module.exports = initEnquiryFollowupReminderJob;
