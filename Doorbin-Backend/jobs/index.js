const initAutoMarkAbsentJob = require('./autoMarkAbsent.job');
const initRecalcTaskDelayJob = require('./recalcTaskDelay.job');
const initRecalcProjectProgressJob = require('./recalcProjectProgress.job');
const initInvoiceReminderJob = require('./invoiceReminder.job');
const initEnquiryFollowupReminderJob = require('./enquiryFollowupReminder.job');
const initProject2DayReminderJob = require('./project2DayReminder.job');
const initAutoStartScheduledTasksJob = require('./autoStartScheduledTasks.job');

function initAllCronJobs() {
  console.log('[Automation Engine] Initializing system background cron jobs...');
  initAutoMarkAbsentJob();
  initRecalcTaskDelayJob();
  initRecalcProjectProgressJob();
  initInvoiceReminderJob();
  initEnquiryFollowupReminderJob();
  initProject2DayReminderJob();
  initAutoStartScheduledTasksJob();
  console.log('[Automation Engine] All background cron jobs registered successfully.');
}

module.exports = initAllCronJobs;
