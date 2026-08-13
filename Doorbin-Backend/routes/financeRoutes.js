const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/financeController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

const financeAccess = checkPermission('financeAccess');
const financeOrBdAccess = (req, res, next) => {
  const roleName = req.user?.role?.name;
  const p = req.user?.role?.permissions;
  if (roleName === 'Director' || p?.financeAccess || p?.businessDevAccess || p?.userManagement) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Finance, BD, or Director permission required.' });
};
const directorAccess = (req, res, next) => {
  const roleName = req.user?.role?.name;
  if (roleName === 'Director' || req.user?.role?.permissions?.systemConfiguration === true) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Director role required.' });
};

/**
 * @swagger
 * tags:
 *   name: Finance Management
 *   description: Project Quotations, Invoices, Payments, Receivables Ageing, Cashflow, Turnover & Financial Statements
 */

// --- QUOTATIONS ---
/**
 * @swagger
 * /finance/quotations:
 *   get:
 *     summary: Get all quotations with status & project filters
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Draft, Sent, Accepted, Rejected]
 *     responses:
 *       200:
 *         description: List of quotations
 *   post:
 *     summary: Create a new quotation (Auto-generates financial year quotationNumber)
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client
 *               - amount
 *             properties:
 *               client:
 *                 type: string
 *               project:
 *                 type: string
 *               amount:
 *                 type: number
 *               date:
 *                 type: string
 *                 example: "10/08/2026"
 *               validTill:
 *                 type: string
 *                 example: "10/09/2026"
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Quotation created successfully
 */
router.route('/quotations')
  .get(protect, financeAccess, getQuotations)
  .post(protect, financeAccess, createQuotation);

/**
 * @swagger
 * /finance/quotations/{id}:
 *   get:
 *     summary: Get single quotation details
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quotation details
 *   put:
 *     summary: Update quotation details & status
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [Draft, Sent, Accepted, Rejected]
 *               validTill:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Quotation updated
 *   delete:
 *     summary: Delete quotation (Blocked if linked to invoices)
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quotation deleted
 */
router.route('/quotations/:id')
  .get(protect, financeOrBdAccess, getQuotationById)
  .put(protect, financeOrBdAccess, updateQuotation)
  .delete(protect, financeOrBdAccess, deleteQuotation);

// --- INVOICES ---
/**
 * @swagger
 * /finance/invoices:
 *   get:
 *     summary: Get all invoices with pagination & status filters
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Paid, Overdue, Partially Paid]
 *     responses:
 *       200:
 *         description: List of invoices
 *   post:
 *     summary: Create invoice (Server computes GST & totalAmount)
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client
 *               - project
 *               - amount
 *             properties:
 *               client:
 *                 type: string
 *               project:
 *                 type: string
 *               quotation:
 *                 type: string
 *               amount:
 *                 type: number
 *                 description: Pre-tax amount
 *               gstRate:
 *                 type: number
 *                 default: 18
 *               issueDate:
 *                 type: string
 *                 example: "10/08/2026"
 *               dueDate:
 *                 type: string
 *                 example: "24/08/2026"
 *     responses:
 *       201:
 *         description: Invoice created with computed totalAmount
 */
router.route('/invoices')
  .get(protect, financeAccess, getInvoices)
  .post(protect, financeAccess, createInvoice);

/**
 * @swagger
 * /finance/invoices/{id}:
 *   get:
 *     summary: Get invoice details including linked payments & remaining balance
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice detail profile
 *   put:
 *     summary: Update invoice due date or status
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice updated
 *   delete:
 *     summary: Delete invoice (Blocked if payments exist)
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice deleted
 */
router.route('/invoices/:id')
  .get(protect, financeAccess, getInvoiceById)
  .put(protect, financeAccess, updateInvoice)
  .delete(protect, financeAccess, deleteInvoice);

// --- PAYMENTS ---
/**
 * @swagger
 * /finance/payments:
 *   get:
 *     summary: Get payment logs with date range & client filters
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *       - in: query
 *         name: invoice
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment logs
 *   post:
 *     summary: Record payment against invoice (Triggers synchronous invoice status recalculation)
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoice
 *               - amountPaid
 *               - paymentMode
 *             properties:
 *               invoice:
 *                 type: string
 *               amountPaid:
 *                 type: number
 *               paymentDate:
 *                 type: string
 *               paymentMode:
 *                 type: string
 *                 enum: [Cash, Bank Transfer, Cheque, UPI, Other]
 *               referenceNumber:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment recorded and invoice status updated
 */
router.route('/payments')
  .get(protect, financeAccess, getPayments)
  .post(protect, financeAccess, createPayment);

/**
 * @swagger
 * /finance/payments/{id}:
 *   delete:
 *     summary: Delete/correct payment record (Recalculates invoice status)
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment deleted and invoice recalculated
 */
router.delete('/payments/:id', protect, financeAccess, deletePayment);

// --- RECEIVABLES & AGEING ---
/**
 * @swagger
 * /finance/due-payments:
 *   get:
 *     summary: Get due payments & receivables ageing breakdown (0-30, 31-60, 61-90, 90+ days)
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Receivables ageing report
 */
router.get('/due-payments', protect, financeAccess, getDuePayments);
router.get('/receivables-ageing', protect, financeAccess, getDuePayments);

/**
 * @swagger
 * /finance/outstanding-summary:
 *   get:
 *     summary: Get studio-wide outstanding dues summary grouped by client
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Client-wise outstanding dues summary
 */
router.get('/outstanding-summary', protect, financeAccess, getOutstandingSummary);

// --- REPORTS & ANALYTICS ---
/**
 * @swagger
 * /finance/cashflow:
 *   get:
 *     summary: Monthly/Quarterly/Annual Cashflow Report (Grouped strictly by Payment.paymentDate)
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [monthly, quarterly, annual]
 *           default: monthly
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           default: 2026
 *     responses:
 *       200:
 *         description: Cashflow time-series report
 */
router.get('/cashflow', protect, financeAccess, getCashflowReport);
router.get('/reports/cashflow', protect, financeAccess, getCashflowReport);
router.get('/reports/outstanding', protect, financeAccess, getOutstandingSummary);

/**
 * @swagger
 * /finance/turnover:
 *   get:
 *     summary: Monthly/Quarterly/Annual Turnover Report (Grouped strictly by Invoice.issueDate)
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [monthly, quarterly, annual]
 *           default: monthly
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           default: 2026
 *     responses:
 *       200:
 *         description: Turnover time-series report
 */
router.get('/turnover', protect, financeAccess, getTurnoverReport);

/**
 * @swagger
 * /finance/revenue-by-type:
 *   get:
 *     summary: Revenue by Project Type (Category) breakdown
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue breakdown by Architecture, Interior Design, Animation
 */
router.get('/revenue-by-type', protect, financeAccess, getRevenueByProjectTypeReport);

// --- STATEMENTS ---
/**
 * @swagger
 * /finance/client-statement/{clientId}:
 *   get:
 *     summary: Get Client Financial Statement (Quotations, Invoices, Payments summary)
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full client financial statement profile
 */
router.get('/client-statement/:clientId', protect, financeAccess, getClientStatement);

/**
 * @swagger
 * /finance/project-statement/{projectId}:
 *   get:
 *     summary: Get Project Financial Statement
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full project financial statement profile
 */
router.get('/project-statement/:projectId', protect, financeAccess, getProjectStatement);

// --- SETTINGS ---
/**
 * @swagger
 * /finance/settings:
 *   get:
 *     summary: Get studio finance settings (default GST rate & numbering formats)
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Studio finance settings
 *   put:
 *     summary: Update studio finance settings (Director ONLY)
 *     tags: [Finance Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               defaultGstRate:
 *                 type: number
 *                 example: 18
 *               quotationNumberFormat:
 *                 type: string
 *                 example: "DV/Q/{FY}/{SEQ}"
 *               invoiceNumberFormat:
 *                 type: string
 *                 example: "DV/INV/{FY}/{SEQ}"
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.route('/settings')
  .get(protect, financeAccess, getFinanceSettings)
  .put(protect, directorAccess, updateFinanceSettings);

module.exports = router;
