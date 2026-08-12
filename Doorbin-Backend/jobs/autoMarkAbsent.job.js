const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const Leave = require('../models/Leave');

/**
 * Runs daily at 11:59 PM to auto-mark absent for employees who haven't clocked in and are not on leave/holiday.
 */
function initAutoMarkAbsentJob() {
  cron.schedule('59 23 * * *', async () => {
    try {
      console.log('[Cron Job] Starting daily auto-mark absent job...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if today is a studio holiday
      const isHoliday = await Holiday.findOne({ date: today });
      if (isHoliday) {
        console.log(`[Cron Job] Today (${today.toISOString().split('T')[0]}) is a holiday (${isHoliday.name}). Skipping auto-absent.`);
        return;
      }

      // Check active users
      const activeUsers = await User.find({ status: 'Active' });

      for (const emp of activeUsers) {
        // Check if attendance record already exists for today
        const existingAttendance = await Attendance.findOne({
          employee: emp._id,
          date: today
        });

        if (!existingAttendance) {
          // Check if employee has approved leave for today
          const onLeave = await Leave.findOne({
            employee: emp._id,
            status: 'Approved',
            fromDate: { $lte: today },
            toDate: { $gte: today }
          });

          if (onLeave) {
            await Attendance.create({
              employee: emp._id,
              date: today,
              status: 'On Leave',
              remarks: `Auto-marked from approved leave (${onLeave.leaveType})`
            });
          } else {
            await Attendance.create({
              employee: emp._id,
              date: today,
              status: 'Absent',
              remarks: 'Auto-marked absent by system (no clock-in recorded)'
            });
          }
        }
      }
      console.log('[Cron Job] Daily auto-mark absent job completed successfully.');
    } catch (error) {
      console.error('[Cron Job Error] autoMarkAbsent.job:', error.message);
    }
  });
}

module.exports = initAutoMarkAbsentJob;
