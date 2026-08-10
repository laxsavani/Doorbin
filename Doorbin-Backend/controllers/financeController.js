const Quotation = require('../models/Quotation');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const FinanceSettings = require('../models/FinanceSettings');
const FinanceCounter = require('../models/FinanceCounter');
const Client = require('../models/Client');
const Project = require('../models/Project');
const logActivity = require('../utils/activityLogger');
const { formatDDMMYYYY, parseDateString } = require('../utils/dateFormatter');
const mongoose = require('mongoose');

// Helper: Compute Indian Financial Year string (e.g., "2026-27")
const getFinancialYear = (dateInput = new Date()) => {
  const d = new Date(dateInput);
  const month = d.getMonth(); // 0 = Jan, 3 = Apr
  const year = d.getFullYear();

  let startYear = year;
  if (month < 3) { // Jan, Feb, Mar belong to previous FY
    startYear = year - 1;
  }
  const endYearSuffix = String(startYear + 1).slice(-2);
  return `${startYear}-${endYearSuffix}`;
};

// Helper: Get or initialize FinanceSettings document
const getSettingsDoc = async () => {
  let settings = await FinanceSettings.findOne({});
  if (!settings) {
    settings = await FinanceSettings.create({
      defaultGstRate: 18,
      quotationNumberFormat: 'DV/Q/{FY}/{SEQ}',
      invoiceNumberFormat: 'DV/INV/{FY}/{SEQ}'
    });
  }
  return settings;
};

// Helper: Atomic document number generator using FinanceCounter
const generateDocumentNumber = async (type, targetDate = new Date()) => {
  const fy = getFinancialYear(targetDate);
  const counter = await FinanceCounter.findOneAndUpdate(
    { fy, type },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );

  const seqPadded = String(counter.seq).padStart(4, '0');
  const settings = await getSettingsDoc();

  const template = type === 'Quotation'
    ? settings.quotationNumberFormat
    : settings.invoiceNumberFormat;

  return template.replace('{FY}', fy).replace('{SEQ}', seqPadded);
};

// Helper: Recalculate linked Invoice status and payment balances
const recalculateInvoiceStatus = async (invoiceId) => {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return null;

  const payments = await Payment.find({ invoice: invoiceId });
  const totalPaid = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);

  const roundedTotalPaid = Number(totalPaid.toFixed(2));
  const roundedTotalAmount = Number(invoice.totalAmount.toFixed(2));

  let newStatus = 'Pending';
  const now = new Date();

  if (roundedTotalPaid >= roundedTotalAmount) {
    newStatus = 'Paid';
  } else if (roundedTotalPaid > 0) {
    newStatus = 'Partially Paid';
  } else if (invoice.dueDate && new Date(invoice.dueDate) < now) {
    newStatus = 'Overdue';
  }

  invoice.status = newStatus;
  await invoice.save();

  const remainingBalance = Math.max(0, Number((roundedTotalAmount - roundedTotalPaid).toFixed(2)));
  const overpaidAmount = Math.max(0, Number((roundedTotalPaid - roundedTotalAmount).toFixed(2)));

  return {
    invoiceId: invoice._id,
    totalAmount: roundedTotalAmount,
    totalPaid: roundedTotalPaid,
    remainingBalance,
    overpaidAmount,
    status: newStatus,
    paymentsCount: payments.length
  };
};

// ============================================================
// QUOTATIONS CONTROLLERS
// ============================================================

// @desc    Create a new Quotation
// @route   POST /api/finance/quotations
// @access  Private (FinanceAccess permission holder)
const createQuotation = async (req, res) => {
  const { client, project, amount, date, validTill, notes } = req.body;

  if (!client || !mongoose.Types.ObjectId.isValid(client)) {
    return res.status(400).json({ message: 'Valid client ID is required' });
  }

  if (amount === undefined || isNaN(Number(amount)) || Number(amount) < 0) {
    return res.status(400).json({ message: 'Valid quotation amount is required' });
  }

  try {
    const clientObj = await Client.findById(client);
    if (!clientObj) {
      return res.status(404).json({ message: 'Client not found' });
    }

    let projectObj = null;
    if (project && mongoose.Types.ObjectId.isValid(project)) {
      projectObj = await Project.findById(project);
      if (!projectObj) {
        return res.status(404).json({ message: 'Project not found' });
      }
    }

    const qDate = date ? parseDateString(date) : new Date();
    const qValidTill = validTill ? parseDateString(validTill, true) : new Date(qDate.getTime() + 30 * 86400000);
    const quotationNumber = await generateDocumentNumber('Quotation', qDate);

    const quotation = await Quotation.create({
      client,
      project: projectObj ? projectObj._id : null,
      quotationNumber,
      amount: Number(amount),
      date: qDate,
      validTill: qValidTill,
      status: 'Draft',
      notes: notes ? String(notes).trim() : '',
      createdBy: req.user._id
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'QUOTATION_CREATED',
      targetType: 'Quotation',
      targetId: quotation._id,
      metadata: { quotationNumber, amount: quotation.amount, client: clientObj.companyName }
    });

    const populated = await Quotation.findById(quotation._id)
      .populate('client', 'companyName clientName email')
      .populate('project', 'projectName projectCategory')
      .populate('createdBy', 'name email');

    return res.status(201).json({
      ...populated.toObject(),
      dateFormatted: formatDDMMYYYY(populated.date),
      validTillFormatted: formatDDMMYYYY(populated.validTill)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all Quotations
// @route   GET /api/finance/quotations
// @access  Private (FinanceAccess permission holder)
const getQuotations = async (req, res) => {
  try {
    const { client, project, status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (client && mongoose.Types.ObjectId.isValid(client)) query.client = client;
    if (project && mongoose.Types.ObjectId.isValid(project)) query.project = project;
    if (status) query.status = status;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Quotation.countDocuments(query);
    const quotations = await Quotation.find(query)
      .populate('client', 'companyName clientName')
      .populate('project', 'projectName projectCategory')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const formatted = quotations.map(q => ({
      ...q.toObject(),
      dateFormatted: formatDDMMYYYY(q.date),
      validTillFormatted: formatDDMMYYYY(q.validTill)
    }));

    return res.json({
      totalCount: total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      quotations: formatted
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get single Quotation by ID
// @route   GET /api/finance/quotations/:id
// @access  Private (FinanceAccess permission holder)
const getQuotationById = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('client', 'companyName clientName email phone address gstDetails')
      .populate('project', 'projectName projectCategory budget')
      .populate('createdBy', 'name email');

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    return res.json({
      ...quotation.toObject(),
      dateFormatted: formatDDMMYYYY(quotation.date),
      validTillFormatted: formatDDMMYYYY(quotation.validTill)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update Quotation details & status
// @route   PUT /api/finance/quotations/:id
// @access  Private (FinanceAccess permission holder)
const updateQuotation = async (req, res) => {
  const { amount, status, validTill, notes } = req.body;

  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    if (amount !== undefined) quotation.amount = Number(amount);
    if (status) {
      if (!['Draft', 'Sent', 'Accepted', 'Rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid quotation status' });
      }
      quotation.status = status;
    }
    if (validTill) quotation.validTill = parseDateString(validTill, true);
    if (notes !== undefined) quotation.notes = String(notes).trim();

    await quotation.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'QUOTATION_UPDATED',
      targetType: 'Quotation',
      targetId: quotation._id,
      metadata: { quotationNumber: quotation.quotationNumber, status: quotation.status }
    });

    const updated = await Quotation.findById(quotation._id)
      .populate('client', 'companyName clientName')
      .populate('project', 'projectName projectCategory')
      .populate('createdBy', 'name email');

    return res.json({
      ...updated.toObject(),
      dateFormatted: formatDDMMYYYY(updated.date),
      validTillFormatted: formatDDMMYYYY(updated.validTill)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete Quotation
// @route   DELETE /api/finance/quotations/:id
// @access  Private (FinanceAccess permission holder)
const deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    // Safety rail: Block deletion if linked to existing Invoices
    const invoiceCount = await Invoice.countDocuments({ quotation: quotation._id });
    if (invoiceCount > 0) {
      return res.status(400).json({ message: `Cannot delete quotation '${quotation.quotationNumber}' because ${invoiceCount} invoice(s) reference it.` });
    }

    await Quotation.findByIdAndDelete(quotation._id);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'QUOTATION_DELETED',
      targetType: 'Quotation',
      targetId: quotation._id,
      metadata: { quotationNumber: quotation.quotationNumber }
    });

    return res.json({ message: `Quotation '${quotation.quotationNumber}' deleted successfully` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// INVOICES CONTROLLERS
// ============================================================

// @desc    Create a new Invoice with server-computed GST and totalAmount
// @route   POST /api/finance/invoices
// @access  Private (FinanceAccess permission holder)
const createInvoice = async (req, res) => {
  const { client, project, quotation, amount, gstRate, issueDate, dueDate } = req.body;

  if (!client || !mongoose.Types.ObjectId.isValid(client)) {
    return res.status(400).json({ message: 'Valid client ID is required' });
  }
  if (!project || !mongoose.Types.ObjectId.isValid(project)) {
    return res.status(400).json({ message: 'Valid project ID is required' });
  }
  if (amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ message: 'Valid positive invoice pre-tax amount is required' });
  }

  try {
    const clientObj = await Client.findById(client);
    if (!clientObj) return res.status(404).json({ message: 'Client not found' });

    const projectObj = await Project.findById(project);
    if (!projectObj) return res.status(404).json({ message: 'Project not found' });

    const settings = await getSettingsDoc();
    const appliedGstRate = gstRate !== undefined ? Number(gstRate) : settings.defaultGstRate;

    // Server-side strict GST computation
    const amountNum = Number(amount);
    const gstNum = Number((amountNum * (appliedGstRate / 100)).toFixed(2));
    const totalAmountNum = Number((amountNum + gstNum).toFixed(2));

    const iIssueDate = issueDate ? parseDateString(issueDate) : new Date();
    const iDueDate = dueDate ? parseDateString(dueDate, true) : new Date(iIssueDate.getTime() + 14 * 86400000);

    const invoiceNumber = await generateDocumentNumber('Invoice', iIssueDate);

    const initialStatus = new Date() > iDueDate ? 'Overdue' : 'Pending';

    const invoice = await Invoice.create({
      client,
      project,
      quotation: quotation && mongoose.Types.ObjectId.isValid(quotation) ? quotation : null,
      invoiceNumber,
      amount: amountNum,
      gstRate: appliedGstRate,
      gst: gstNum,
      totalAmount: totalAmountNum,
      issueDate: iIssueDate,
      dueDate: iDueDate,
      status: initialStatus,
      createdBy: req.user._id
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'INVOICE_CREATED',
      targetType: 'Invoice',
      targetId: invoice._id,
      metadata: { invoiceNumber, totalAmount: totalAmountNum, client: clientObj.companyName }
    });

    const populated = await Invoice.findById(invoice._id)
      .populate('client', 'companyName clientName email')
      .populate('project', 'projectName projectCategory')
      .populate('createdBy', 'name email');

    return res.status(201).json({
      ...populated.toObject(),
      issueDateFormatted: formatDDMMYYYY(populated.issueDate),
      dueDateFormatted: formatDDMMYYYY(populated.dueDate)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all Invoices with pagination & status filters
// @route   GET /api/finance/invoices
// @access  Private (FinanceAccess permission holder)
const getInvoices = async (req, res) => {
  try {
    const { client, project, status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (client && mongoose.Types.ObjectId.isValid(client)) query.client = client;
    if (project && mongoose.Types.ObjectId.isValid(project)) query.project = project;
    if (status) query.status = status;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Invoice.countDocuments(query);
    const invoices = await Invoice.find(query)
      .populate('client', 'companyName clientName')
      .populate('project', 'projectName projectCategory')
      .populate('createdBy', 'name email')
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const formatted = await Promise.all(invoices.map(async inv => {
      const summary = await recalculateInvoiceStatus(inv._id);
      return {
        ...inv.toObject(),
        issueDateFormatted: formatDDMMYYYY(inv.issueDate),
        dueDateFormatted: formatDDMMYYYY(inv.dueDate),
        paidAmount: summary ? summary.totalPaid : 0,
        remainingBalance: summary ? summary.remainingBalance : inv.totalAmount
      };
    }));

    return res.json({
      totalCount: total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      invoices: formatted
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get single Invoice detail including Payments break-down
// @route   GET /api/finance/invoices/:id
// @access  Private (FinanceAccess permission holder)
const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client', 'companyName clientName email phone address gstDetails')
      .populate('project', 'projectName projectCategory budget')
      .populate('quotation', 'quotationNumber amount date')
      .populate('createdBy', 'name email');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const payments = await Payment.find({ invoice: invoice._id })
      .populate('receivedBy', 'name email')
      .sort({ paymentDate: -1 });

    const summary = await recalculateInvoiceStatus(invoice._id);

    return res.json({
      ...invoice.toObject(),
      issueDateFormatted: formatDDMMYYYY(invoice.issueDate),
      dueDateFormatted: formatDDMMYYYY(invoice.dueDate),
      summary,
      payments: payments.map(p => ({
        ...p.toObject(),
        paymentDateFormatted: formatDDMMYYYY(p.paymentDate)
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update Invoice details (due date, notes)
// @route   PUT /api/finance/invoices/:id
// @access  Private (FinanceAccess permission holder)
const updateInvoice = async (req, res) => {
  const { dueDate, status } = req.body;

  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (dueDate) invoice.dueDate = parseDateString(dueDate, true);
    if (status) {
      if (!['Pending', 'Paid', 'Overdue', 'Partially Paid'].includes(status)) {
        return res.status(400).json({ message: 'Invalid invoice status' });
      }
      invoice.status = status;
    }

    await invoice.save();
    await recalculateInvoiceStatus(invoice._id);

    const updated = await Invoice.findById(invoice._id)
      .populate('client', 'companyName clientName')
      .populate('project', 'projectName projectCategory');

    return res.json({
      ...updated.toObject(),
      issueDateFormatted: formatDDMMYYYY(updated.issueDate),
      dueDateFormatted: formatDDMMYYYY(updated.dueDate)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete Invoice
// @route   DELETE /api/finance/invoices/:id
// @access  Private (FinanceAccess permission holder)
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const paymentsCount = await Payment.countDocuments({ invoice: invoice._id });
    if (paymentsCount > 0) {
      return res.status(400).json({ message: `Cannot delete invoice '${invoice.invoiceNumber}' because ${paymentsCount} payment(s) have been recorded against it.` });
    }

    await Invoice.findByIdAndDelete(invoice._id);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'INVOICE_DELETED',
      targetType: 'Invoice',
      targetId: invoice._id,
      metadata: { invoiceNumber: invoice.invoiceNumber }
    });

    return res.json({ message: `Invoice '${invoice.invoiceNumber}' deleted successfully` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// PAYMENTS CONTROLLERS
// ============================================================

// @desc    Record a Payment against an Invoice
// @route   POST /api/finance/payments
// @access  Private (FinanceAccess permission holder)
const createPayment = async (req, res) => {
  const { invoice, amountPaid, paymentDate, paymentMode, referenceNumber, notes } = req.body;

  if (!invoice || !mongoose.Types.ObjectId.isValid(invoice)) {
    return res.status(400).json({ message: 'Valid invoice ID is required' });
  }
  if (amountPaid === undefined || isNaN(Number(amountPaid)) || Number(amountPaid) <= 0) {
    return res.status(400).json({ message: 'Valid positive payment amount is required' });
  }
  if (!paymentMode || !['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Other'].includes(paymentMode)) {
    return res.status(400).json({ message: 'Valid paymentMode (Cash, Bank Transfer, Cheque, UPI, Other) is required' });
  }

  try {
    const invoiceObj = await Invoice.findById(invoice);
    if (!invoiceObj) {
      return res.status(404).json({ message: 'Linked invoice not found' });
    }

    const pDate = paymentDate ? parseDateString(paymentDate) : new Date();

    const payment = await Payment.create({
      invoice: invoiceObj._id,
      client: invoiceObj.client,
      amountPaid: Number(amountPaid),
      paymentDate: pDate,
      paymentMode,
      referenceNumber: referenceNumber ? String(referenceNumber).trim() : '',
      receivedBy: req.user._id,
      notes: notes ? String(notes).trim() : ''
    });

    // Synchronously trigger Invoice status & balance recalculation
    const statusSummary = await recalculateInvoiceStatus(invoiceObj._id);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'PAYMENT_RECORDED',
      targetType: 'Payment',
      targetId: payment._id,
      metadata: { invoiceNumber: invoiceObj.invoiceNumber, amountPaid: payment.amountPaid, newInvoiceStatus: statusSummary?.status }
    });

    const populated = await Payment.findById(payment._id)
      .populate('invoice', 'invoiceNumber amount gst totalAmount status')
      .populate('client', 'companyName clientName')
      .populate('receivedBy', 'name email');

    return res.status(201).json({
      ...populated.toObject(),
      paymentDateFormatted: formatDDMMYYYY(populated.paymentDate),
      invoiceStatusSummary: statusSummary
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Payment logs with filters
// @route   GET /api/finance/payments
// @access  Private (FinanceAccess permission holder)
const getPayments = async (req, res) => {
  try {
    const { client, invoice, from, to } = req.query;

    const query = {};
    if (client && mongoose.Types.ObjectId.isValid(client)) query.client = client;
    if (invoice && mongoose.Types.ObjectId.isValid(invoice)) query.invoice = invoice;

    if (from || to) {
      query.paymentDate = {};
      if (from) query.paymentDate.$gte = parseDateString(from);
      if (to) query.paymentDate.$lte = parseDateString(to, true);
    }

    const payments = await Payment.find(query)
      .populate('invoice', 'invoiceNumber totalAmount status')
      .populate('client', 'companyName clientName')
      .populate('receivedBy', 'name email')
      .sort({ paymentDate: -1 });

    const formatted = payments.map(p => ({
      ...p.toObject(),
      paymentDateFormatted: formatDDMMYYYY(p.paymentDate)
    }));

    return res.json({
      totalCount: formatted.length,
      totalAmountPaid: Number(payments.reduce((sum, p) => sum + p.amountPaid, 0).toFixed(2)),
      payments: formatted
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete/Correct a Payment record
// @route   DELETE /api/finance/payments/:id
// @access  Private (FinanceAccess permission holder)
const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    const invoiceId = payment.invoice;
    await Payment.findByIdAndDelete(payment._id);

    // Recalculate invoice status after removing payment
    const statusSummary = await recalculateInvoiceStatus(invoiceId);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'PAYMENT_DELETED',
      targetType: 'Payment',
      targetId: payment._id,
      metadata: { invoiceId, amountPaid: payment.amountPaid }
    });

    return res.json({
      message: 'Payment record deleted successfully',
      invoiceStatusSummary: statusSummary
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// RECEIVABLES & AGEING ANALYSIS CONTROLLERS
// ============================================================

// @desc    Get Due Payments & Receivables Ageing Buckets (0-30, 31-60, 61-90, 90+ days)
// @route   GET /api/finance/due-payments
// @access  Private (FinanceAccess permission holder)
const getDuePayments = async (req, res) => {
  try {
    const pendingInvoices = await Invoice.find({
      status: { $in: ['Pending', 'Overdue', 'Partially Paid'] }
    })
      .populate('client', 'companyName clientName phone email')
      .populate('project', 'projectName projectCategory')
      .sort({ dueDate: 1 });

    const now = new Date();
    const ageing = {
      notYetDue: [],
      bucket0To30: [],
      bucket31To60: [],
      bucket61To90: [],
      bucket90Plus: []
    };

    let totalOutstandingAmount = 0;

    const results = await Promise.all(pendingInvoices.map(async inv => {
      const summary = await recalculateInvoiceStatus(inv._id);
      const remaining = summary ? summary.remainingBalance : inv.totalAmount;

      if (remaining <= 0) return null;

      totalOutstandingAmount += remaining;

      const due = new Date(inv.dueDate);
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 3600 * 24));

      let bucket = 'Not Yet Due';
      if (daysOverdue > 90) bucket = '90+ Days';
      else if (daysOverdue > 60) bucket = '61-90 Days';
      else if (daysOverdue > 30) bucket = '31-60 Days';
      else if (daysOverdue >= 0) bucket = '0-30 Days';

      const item = {
        invoiceId: inv._id,
        invoiceNumber: inv.invoiceNumber,
        client: inv.client,
        project: inv.project,
        totalAmount: inv.totalAmount,
        paidAmount: summary ? summary.totalPaid : 0,
        outstandingBalance: remaining,
        issueDateFormatted: formatDDMMYYYY(inv.issueDate),
        dueDateFormatted: formatDDMMYYYY(inv.dueDate),
        daysOverdue: Math.max(0, daysOverdue),
        ageingBucket: bucket,
        status: inv.status
      };

      if (daysOverdue < 0) ageing.notYetDue.push(item);
      else if (daysOverdue <= 30) ageing.bucket0To30.push(item);
      else if (daysOverdue <= 60) ageing.bucket31To60.push(item);
      else if (daysOverdue <= 90) ageing.bucket61To90.push(item);
      else ageing.bucket90Plus.push(item);

      return item;
    }));

    const filtered = results.filter(Boolean);

    return res.json({
      totalOutstandingInvoicesCount: filtered.length,
      totalOutstandingAmount: Number(totalOutstandingAmount.toFixed(2)),
      ageingSummary: {
        notYetDueAmount: Number(ageing.notYetDue.reduce((s, i) => s + i.outstandingBalance, 0).toFixed(2)),
        bucket0To30Amount: Number(ageing.bucket0To30.reduce((s, i) => s + i.outstandingBalance, 0).toFixed(2)),
        bucket31To60Amount: Number(ageing.bucket31To60.reduce((s, i) => s + i.outstandingBalance, 0).toFixed(2)),
        bucket61To90Amount: Number(ageing.bucket61To90.reduce((s, i) => s + i.outstandingBalance, 0).toFixed(2)),
        bucket90PlusAmount: Number(ageing.bucket90Plus.reduce((s, i) => s + i.outstandingBalance, 0).toFixed(2))
      },
      ageingDetails: ageing
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Studio-wide Outstanding Summary by Client
// @route   GET /api/finance/outstanding-summary
// @access  Private (FinanceAccess permission holder)
const getOutstandingSummary = async (req, res) => {
  try {
    const clients = await Client.find({ status: 'Active' });
    const summaryList = [];

    let studioTotalOutstanding = 0;

    for (const c of clients) {
      const invoices = await Invoice.find({
        client: c._id,
        status: { $in: ['Pending', 'Overdue', 'Partially Paid'] }
      });

      let clientOutstanding = 0;
      const invoiceSummaries = [];

      for (const inv of invoices) {
        const summary = await recalculateInvoiceStatus(inv._id);
        const rem = summary ? summary.remainingBalance : inv.totalAmount;

        if (rem > 0) {
          clientOutstanding += rem;
          invoiceSummaries.push({
            invoiceId: inv._id,
            invoiceNumber: inv.invoiceNumber,
            totalAmount: inv.totalAmount,
            remainingBalance: rem,
            dueDateFormatted: formatDDMMYYYY(inv.dueDate),
            status: inv.status
          });
        }
      }

      if (clientOutstanding > 0) {
        studioTotalOutstanding += clientOutstanding;
        summaryList.push({
          clientId: c._id,
          companyName: c.companyName,
          clientName: c.clientName,
          totalOutstanding: Number(clientOutstanding.toFixed(2)),
          unpaidInvoicesCount: invoiceSummaries.length,
          invoices: invoiceSummaries
        });
      }
    }

    return res.json({
      studioTotalOutstanding: Number(studioTotalOutstanding.toFixed(2)),
      clientsCount: summaryList.length,
      clientBreakdown: summaryList
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// REPORTS & ANALYTICS CONTROLLERS
// ============================================================

// @desc    Get Cashflow Report (Grouped strictly by Payment.paymentDate)
// @route   GET /api/finance/cashflow
// @access  Private (FinanceAccess permission holder)
const getCashflowReport = async (req, res) => {
  try {
    const { period = 'monthly', year } = req.query;
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();

    const startOfYear = new Date(targetYear, 0, 1, 0, 0, 0);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    const payments = await Payment.find({
      paymentDate: { $gte: startOfYear, $lte: endOfYear }
    }).populate('client', 'companyName');

    const monthsMap = {
      'Jan': 0, 'Feb': 0, 'Mar': 0, 'Apr': 0, 'May': 0, 'Jun': 0,
      'Jul': 0, 'Aug': 0, 'Sep': 0, 'Oct': 0, 'Nov': 0, 'Dec': 0
    };

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let totalAnnualCashflow = 0;

    payments.forEach(p => {
      const pDate = new Date(p.paymentDate);
      const mName = monthNames[pDate.getMonth()];
      const val = p.amountPaid || 0;

      monthsMap[mName] += val;
      totalAnnualCashflow += val;
    });

    Object.keys(monthsMap).forEach(k => monthsMap[k] = Number(monthsMap[k].toFixed(2)));

    return res.json({
      year: targetYear,
      reportType: 'Cashflow (Actual Received Funds)',
      totalAnnualCashflow: Number(totalAnnualCashflow.toFixed(2)),
      period,
      monthlyBreakdown: monthsMap
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Turnover Report (Grouped strictly by Invoice.issueDate)
// @route   GET /api/finance/turnover
// @access  Private (FinanceAccess permission holder)
const getTurnoverReport = async (req, res) => {
  try {
    const { period = 'monthly', year } = req.query;
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();

    const startOfYear = new Date(targetYear, 0, 1, 0, 0, 0);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    const invoices = await Invoice.find({
      issueDate: { $gte: startOfYear, $lte: endOfYear }
    });

    const monthsMap = {
      'Jan': 0, 'Feb': 0, 'Mar': 0, 'Apr': 0, 'May': 0, 'Jun': 0,
      'Jul': 0, 'Aug': 0, 'Sep': 0, 'Oct': 0, 'Nov': 0, 'Dec': 0
    };

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let totalAnnualTurnoverBilled = 0;
    let totalAnnualTurnoverPreTax = 0;

    invoices.forEach(inv => {
      const iDate = new Date(inv.issueDate);
      const mName = monthNames[iDate.getMonth()];
      const val = inv.totalAmount || 0;

      monthsMap[mName] += val;
      totalAnnualTurnoverBilled += val;
      totalAnnualTurnoverPreTax += inv.amount || 0;
    });

    Object.keys(monthsMap).forEach(k => monthsMap[k] = Number(monthsMap[k].toFixed(2)));

    return res.json({
      year: targetYear,
      reportType: 'Turnover (Billed Invoices)',
      totalAnnualTurnoverBilled: Number(totalAnnualTurnoverBilled.toFixed(2)),
      totalAnnualTurnoverPreTax: Number(totalAnnualTurnoverPreTax.toFixed(2)),
      period,
      monthlyBreakdown: monthsMap
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Revenue by Project Type (Category) Report
// @route   GET /api/finance/revenue-by-type
// @access  Private (FinanceAccess permission holder)
const getRevenueByProjectTypeReport = async (req, res) => {
  try {
    const invoices = await Invoice.find({}).populate('project', 'projectName projectCategory');

    const revenueByCat = {
      'Architecture': 0,
      'Interior Design': 0,
      'Animation': 0,
      'Unclassified': 0
    };

    let grandTotalRevenue = 0;

    invoices.forEach(inv => {
      const cat = inv.project?.projectCategory || 'Unclassified';
      const amt = inv.totalAmount || 0;

      if (revenueByCat[cat] !== undefined) revenueByCat[cat] += amt;
      else revenueByCat['Unclassified'] += amt;

      grandTotalRevenue += amt;
    });

    Object.keys(revenueByCat).forEach(k => revenueByCat[k] = Number(revenueByCat[k].toFixed(2)));

    return res.json({
      grandTotalBilledRevenue: Number(grandTotalRevenue.toFixed(2)),
      revenueByCategory: revenueByCat
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// STATEMENTS CONTROLLERS
// ============================================================

// @desc    Get Client Financial Statement
// @route   GET /api/finance/client-statement/:clientId
// @access  Private (FinanceAccess permission holder)
const getClientStatement = async (req, res) => {
  const { clientId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    return res.status(400).json({ message: 'Invalid client ID' });
  }

  try {
    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const quotations = await Quotation.find({ client: clientId }).sort({ date: -1 });
    const invoices = await Invoice.find({ client: clientId }).sort({ issueDate: -1 });
    const payments = await Payment.find({ client: clientId }).sort({ paymentDate: -1 });

    const totalQuotedAmount = quotations.reduce((sum, q) => sum + q.amount, 0);
    const totalBilledAmount = invoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalPaidAmount = payments.reduce((sum, p) => sum + p.amountPaid, 0);

    const outstandingBalance = Math.max(0, Number((totalBilledAmount - totalPaidAmount).toFixed(2)));

    return res.json({
      client: { clientId: client._id, companyName: client.companyName, clientName: client.clientName, gstDetails: client.gstDetails },
      dateFormat: 'DD/MM/YYYY',
      financialSummary: {
        totalQuotedAmount: Number(totalQuotedAmount.toFixed(2)),
        totalBilledAmount: Number(totalBilledAmount.toFixed(2)),
        totalPaidAmount: Number(totalPaidAmount.toFixed(2)),
        outstandingBalance
      },
      quotations: quotations.map(q => ({ ...q.toObject(), dateFormatted: formatDDMMYYYY(q.date) })),
      invoices: invoices.map(i => ({ ...i.toObject(), issueDateFormatted: formatDDMMYYYY(i.issueDate), dueDateFormatted: formatDDMMYYYY(i.dueDate) })),
      payments: payments.map(p => ({ ...p.toObject(), paymentDateFormatted: formatDDMMYYYY(p.paymentDate) }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get Project Financial Statement
// @route   GET /api/finance/project-statement/:projectId
// @access  Private (FinanceAccess permission holder)
const getProjectStatement = async (req, res) => {
  const { projectId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: 'Invalid project ID' });
  }

  try {
    const project = await Project.findById(projectId).populate('client', 'companyName clientName');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const quotations = await Quotation.find({ project: projectId }).sort({ date: -1 });
    const invoices = await Invoice.find({ project: projectId }).sort({ issueDate: -1 });
    
    const invoiceIds = invoices.map(i => i._id);
    const payments = await Payment.find({ invoice: { $in: invoiceIds } }).sort({ paymentDate: -1 });

    const totalQuotedAmount = quotations.reduce((sum, q) => sum + q.amount, 0);
    const totalBilledAmount = invoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalPaidAmount = payments.reduce((sum, p) => sum + p.amountPaid, 0);

    const outstandingBalance = Math.max(0, Number((totalBilledAmount - totalPaidAmount).toFixed(2)));

    return res.json({
      project: { projectId: project._id, projectName: project.projectName, projectCategory: project.projectCategory, client: project.client },
      dateFormat: 'DD/MM/YYYY',
      financialSummary: {
        totalQuotedAmount: Number(totalQuotedAmount.toFixed(2)),
        totalBilledAmount: Number(totalBilledAmount.toFixed(2)),
        totalPaidAmount: Number(totalPaidAmount.toFixed(2)),
        outstandingBalance
      },
      quotations: quotations.map(q => ({ ...q.toObject(), dateFormatted: formatDDMMYYYY(q.date) })),
      invoices: invoices.map(i => ({ ...i.toObject(), issueDateFormatted: formatDDMMYYYY(i.issueDate), dueDateFormatted: formatDDMMYYYY(i.dueDate) })),
      payments: payments.map(p => ({ ...p.toObject(), paymentDateFormatted: formatDDMMYYYY(p.paymentDate) }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ============================================================
// SETTINGS CONTROLLERS
// ============================================================

// @desc    Get Finance Settings (Default GST Rate & Number Formats)
// @route   GET /api/finance/settings
// @access  Private (FinanceAccess permission holder)
const getFinanceSettings = async (req, res) => {
  try {
    const settings = await getSettingsDoc();
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update Finance Settings (Director ONLY)
// @route   PUT /api/finance/settings
// @access  Private (Director ONLY - systemConfiguration)
const updateFinanceSettings = async (req, res) => {
  const isDirector = req.user?.role?.name === 'Director' || req.user?.role?.permissions?.systemConfiguration === true;
  if (!isDirector) {
    return res.status(403).json({ message: 'Access denied. Director role required to modify finance system settings.' });
  }

  const { defaultGstRate, quotationNumberFormat, invoiceNumberFormat } = req.body;

  try {
    const settings = await getSettingsDoc();

    if (defaultGstRate !== undefined) {
      if (isNaN(Number(defaultGstRate)) || Number(defaultGstRate) < 0 || Number(defaultGstRate) > 100) {
        return res.status(400).json({ message: 'Invalid GST rate percentage (must be between 0 and 100)' });
      }
      settings.defaultGstRate = Number(defaultGstRate);
    }

    if (quotationNumberFormat) settings.quotationNumberFormat = String(quotationNumberFormat).trim();
    if (invoiceNumberFormat) settings.invoiceNumberFormat = String(invoiceNumberFormat).trim();

    await settings.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'FINANCE_SETTINGS_UPDATED',
      targetType: 'FinanceSettings',
      targetId: settings._id,
      metadata: { defaultGstRate: settings.defaultGstRate }
    });

    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  deleteQuotation,
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  createPayment,
  getPayments,
  deletePayment,
  getDuePayments,
  getOutstandingSummary,
  getCashflowReport,
  getTurnoverReport,
  getRevenueByProjectTypeReport,
  getClientStatement,
  getProjectStatement,
  getFinanceSettings,
  updateFinanceSettings
};
