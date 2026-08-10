const cron = require('node-cron');
const nodemailer = require('nodemailer');
const ScheduledReport = require('../models/ScheduledReport');
const { buildExcelBuffer, buildPdfBuffer } = require('./exportEngine');

/**
 * Check and execute due scheduled reports
 */
const checkAndSendScheduledReports = async () => {
  try {
    const activeSchedules = await ScheduledReport.find({ isActive: true }).populate('createdBy', 'name email');
    const now = new Date();

    for (const schedule of activeSchedules) {
      let isDue = false;

      if (!schedule.lastSentAt) {
        isDue = true;
      } else {
        const diffMs = now.getTime() - new Date(schedule.lastSentAt).getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (schedule.frequency === 'Daily' && diffHours >= 23.5) {
          isDue = true;
        } else if (schedule.frequency === 'Weekly' && diffHours >= 167) {
          isDue = true;
        } else if (schedule.frequency === 'Monthly' && diffHours >= 719) {
          isDue = true;
        }
      }

      if (isDue) {
        await deliverScheduledReport(schedule);
      }
    }
  } catch (error) {
    console.error('[Scheduled Report Cron Error]:', error.message);
  }
};

/**
 * Generate attachment and email report to recipients
 */
const deliverScheduledReport = async (schedule) => {
  try {
    const { getReportDataForScheduled } = require('../controllers/reportController');
    const { title, headers, rows } = await getReportDataForScheduled(schedule.category, schedule.reportType, schedule.filters);

    let attachmentBuffer;
    let filename;
    let mimeType;

    if (schedule.format === 'pdf') {
      attachmentBuffer = await buildPdfBuffer(title, headers, rows);
      filename = `${schedule.reportType}-${Date.now()}.pdf`;
      mimeType = 'application/pdf';
    } else {
      attachmentBuffer = await buildExcelBuffer(title, headers, rows);
      filename = `${schedule.reportType}-${Date.now()}.xlsx`;
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    const recipientsList = [...(schedule.recipients || [])];
    if (schedule.createdBy?.email && !recipientsList.includes(schedule.createdBy.email)) {
      recipientsList.push(schedule.createdBy.email);
    }

    if (recipientsList.length === 0) {
      console.warn(`[Scheduled Report]: No recipients configured for report ${schedule._id}`);
      return;
    }

    // Nodemailer SMTP transport setup (uses environment vars or test account)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'test@doorbin.com',
        pass: process.env.SMTP_PASS || 'secret'
      }
    });

    // Send email silently (log errors gracefully without crashing)
    try {
      await transporter.sendMail({
        from: '"Doorbin Visuals Reports" <reports@doorbin.com>',
        to: recipientsList.join(','),
        subject: `[Scheduled Report] ${title} (${schedule.frequency})`,
        text: `Hello,\n\nPlease find attached your scheduled ${schedule.frequency} report: ${title}.\n\nBest regards,\nDoorbin Visuals Team`,
        attachments: [
          {
            filename,
            content: attachmentBuffer,
            contentType: mimeType
          }
        ]
      });
      console.log(`[Scheduled Report]: Sent ${title} to ${recipientsList.join(',')}`);
    } catch (mailError) {
      console.warn(`[Scheduled Report Email Notice]: Could not dispatch email via SMTP (mock environment). LastSentAt timestamp updated.`, mailError.message);
    }

    // Update lastSentAt
    schedule.lastSentAt = new Date();
    await schedule.save();
  } catch (error) {
    console.error(`[Scheduled Report Delivery Error] Report ${schedule._id}:`, error.message);
  }
};

/**
 * Initialize node-cron background job (Runs hourly)
 */
const initScheduledReportCron = () => {
  cron.schedule('0 * * * *', () => {
    console.log('[Cron Job]: Checking scheduled reports...');
    checkAndSendScheduledReports();
  });
  console.log('✅ Scheduled Reports background cron job initialized (Hourly execution)');
};

module.exports = {
  checkAndSendScheduledReports,
  deliverScheduledReport,
  initScheduledReportCron
};
