const cron = require('node-cron');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Role = require('../models/Role');
const Notification = require('../models/Notification');

/**
 * Runs daily at 09:00 AM to send reminders for unpaid or overdue invoices.
 */
function initInvoiceReminderJob() {
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('[Cron Job] Starting daily invoice due reminder job...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const threeDaysLater = new Date(today);
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);

      const dueInvoices = await Invoice.find({
        status: { $in: ['Unpaid', 'Partially Paid', 'unpaid', 'partial'] },
        dueDate: { $lte: threeDaysLater }
      }).populate('client project');

      if (!dueInvoices.length) return;

      const dirRole = await Role.findOne({ name: 'Director' });
      const bdRole = await Role.findOne({ name: 'Business Development Manager' });
      const rolesToNotify = [dirRole?._id, bdRole?._id].filter(Boolean);
      const targetUsers = await User.find({ role: { $in: rolesToNotify }, status: 'Active' });

      for (const inv of dueInvoices) {
        const isOverdue = inv.dueDate && new Date(inv.dueDate) < today;
        const msg = isOverdue
          ? `OVERDUE INVOICE: Invoice ${inv.invoiceNumber} (${inv.client?.clientName || inv.client?.companyName || 'Client'}) was due on ${new Date(inv.dueDate).toLocaleDateString()}.`
          : `INVOICE DUE SOON: Invoice ${inv.invoiceNumber} is due on ${new Date(inv.dueDate).toLocaleDateString()}.`;

        for (const user of targetUsers) {
          await Notification.create({
            user: user._id,
            title: isOverdue ? 'Overdue Invoice Alert' : 'Invoice Due Reminder',
            message: msg,
            type: 'FINANCE',
            refId: inv._id
          });
        }
      }

      console.log(`[Cron Job] Invoice reminders sent for ${dueInvoices.length} invoices.`);
    } catch (error) {
      console.error('[Cron Job Error] invoiceReminder.job:', error.message);
    }
  });
}

module.exports = initInvoiceReminderJob;
