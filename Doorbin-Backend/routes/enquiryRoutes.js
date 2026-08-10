const express = require('express');
const router = express.Router();
const {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  updateEnquiry,
  updateEnquiryStatus,
  addActivityLog,
  getActivityLogs,
  addEnquiryAttachment,
  convertEnquiry,
  markConverted,
  getPipelineReport,
  getConversionReport,
  getLostReport,
  getFollowUpReport,
  getRevenueForecastReport,
  deleteEnquiry
} = require('../controllers/enquiryController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

const bdOrDirectorAccess = (req, res, next) => {
  const p = req.user?.role?.permissions;
  if (p?.businessDevAccess || p?.userManagement) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Business Development or Director permission required.' });
};

const financeOrBdOrDirectorAccess = (req, res, next) => {
  const p = req.user?.role?.permissions;
  if (p?.financeAccess || p?.businessDevAccess || p?.userManagement) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Finance, Business Development, or Director permission required.' });
};

/**
 * @swagger
 * tags:
 *   name: Business Development (CRM)
 *   description: Sales Pipeline, Lead Management, Stage Machine, Activity Logs & BD Reports APIs
 */

/**
 * @swagger
 * /enquiries:
 *   post:
 *     summary: Register a new enquiry
 *     tags: [Business Development (CRM)]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientName
 *               - projectName
 *               - projectType
 *               - assignedExecutive
 *             properties:
 *               clientName:
 *                 type: string
 *                 example: Pinnacle Heights Corp
 *               architectName:
 *                 type: string
 *                 example: Studio Form Architects
 *               projectName:
 *                 type: string
 *                 example: Pinnacle Heights Tower 3D Animation
 *               projectType:
 *                 type: string
 *                 enum: [Architecture, Interior Design, Animation]
 *                 example: Animation
 *               estimatedValue:
 *                 type: number
 *                 example: 350000
 *               source:
 *                 type: string
 *                 example: Instagram Ad Campaign
 *               assignedExecutive:
 *                 type: string
 *                 description: User ObjectId of assigned BD executive
 *               followUpDate:
 *                 type: string
 *                 format: date-time
 *               priority:
 *                 type: string
 *                 enum: [High, Medium, Low]
 *                 default: Medium
 *               clientCategory:
 *                 type: string
 *                 enum: [Aspirational, Regulation, Red Flag]
 *                 example: Aspirational
 *               notes:
 *                 type: string
 *               existingClient:
 *                 type: string
 *                 description: Client ObjectId if repeat client
 *     responses:
 *       201:
 *         description: Enquiry registered in 'New Enquiry' stage
 *       400:
 *         description: Validation error or invalid assigned executive
 *       403:
 *         description: BD Manager or Director permission required
 */
router.post('/', protect, checkPermission('businessDevAccess'), createEnquiry);

/**
 * @swagger
 * /enquiries:
 *   get:
 *     summary: List enquiries with status, priority, executive & follow-up filters
 *     tags: [Business Development (CRM)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [New Enquiry, Qualification, Meeting, Proposal, Negotiation, Won, Lost, Project Creation]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [High, Medium, Low]
 *       - in: query
 *         name: assignedExecutive
 *         schema:
 *           type: string
 *       - in: query
 *         name: clientCategory
 *         schema:
 *           type: string
 *           enum: [Aspirational, Regulation, Red Flag]
 *       - in: query
 *         name: followUpDue
 *         schema:
 *           type: string
 *           enum: [today]
 *         description: Set to 'today' for active overdue/due-today enquiries
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of enquiries
 */
router.get('/', protect, bdOrDirectorAccess, getEnquiries);

/**
 * @swagger
 * /enquiries/reports/pipeline:
 *   get:
 *     summary: BD Report - Pipeline Funnel breakdown by stage
 *     tags: [Business Development (CRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Funnel count for each pipeline stage
 */
router.get('/reports/pipeline', protect, bdOrDirectorAccess, getPipelineReport);

/**
 * @swagger
 * /enquiries/reports/conversion:
 *   get:
 *     summary: BD Report - Lead Conversion Rate percentage (Won / Closed)
 *     tags: [Business Development (CRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Won, lost, total closed deals and conversion rate %
 */
router.get('/reports/conversion', protect, bdOrDirectorAccess, getConversionReport);

/**
 * @swagger
 * /enquiries/reports/lost:
 *   get:
 *     summary: BD Report - Lost Opportunities report with lost reasons
 *     tags: [Business Development (CRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of lost enquiries with lost reasons
 */
router.get('/reports/lost', protect, bdOrDirectorAccess, getLostReport);

/**
 * @swagger
 * /enquiries/reports/follow-up:
 *   get:
 *     summary: BD Report - Overdue & Due-Today Follow-up Reminders
 *     tags: [Business Development (CRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue and due-today active enquiries
 */
router.get('/reports/follow-up', protect, bdOrDirectorAccess, getFollowUpReport);

/**
 * @swagger
 * /enquiries/reports/revenue-forecast:
 *   get:
 *     summary: BD Report - Revenue Forecast sum for active pipeline deals
 *     tags: [Business Development (CRM)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total estimated value and stage breakdown for open deals
 */
router.get('/reports/revenue-forecast', protect, financeOrBdOrDirectorAccess, getRevenueForecastReport);

/**
 * @swagger
 * /enquiries/{id}:
 *   get:
 *     summary: Get single enquiry details with history & activity log
 *     tags: [Business Development (CRM)]
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
 *         description: Full enquiry detail
 *       404:
 *         description: Enquiry not found
 */
router.get('/:id', protect, bdOrDirectorAccess, getEnquiryById);

/**
 * @swagger
 * /enquiries/{id}:
 *   put:
 *     summary: Update general enquiry details (disallows direct status change)
 *     tags: [Business Development (CRM)]
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
 *               clientName:
 *                 type: string
 *               architectName:
 *                 type: string
 *               projectName:
 *                 type: string
 *               projectType:
 *                 type: string
 *                 enum: [Architecture, Interior Design, Animation]
 *               estimatedValue:
 *                 type: number
 *               source:
 *                 type: string
 *               assignedExecutive:
 *                 type: string
 *               followUpDate:
 *                 type: string
 *                 format: date-time
 *               priority:
 *                 type: string
 *                 enum: [High, Medium, Low]
 *               clientCategory:
 *                 type: string
 *                 enum: [Aspirational, Regulation, Red Flag]
 *               notes:
 *                 type: string
 *               existingClient:
 *                 type: string
 *     responses:
 *       200:
 *         description: Enquiry updated
 */
router.put('/:id', protect, checkPermission('businessDevAccess'), updateEnquiry);

/**
 * @swagger
 * /enquiries/{id}:
 *   delete:
 *     summary: Delete an enquiry (BD Manager or Director ONLY)
 *     tags: [Business Development (CRM)]
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
 *         description: Enquiry deleted successfully
 *       403:
 *         description: BD Manager or Director role required
 */
router.delete('/:id', protect, bdOrDirectorAccess, deleteEnquiry);

/**
 * @swagger
 * /enquiries/{id}/status:
 *   put:
 *     summary: Transition enquiry pipeline stage (Strict State Machine)
 *     tags: [Business Development (CRM)]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [New Enquiry, Qualification, Meeting, Proposal, Negotiation, Won, Lost]
 *                 example: Qualification
 *               lostReason:
 *                 type: string
 *                 description: Required when status is 'Lost'
 *                 example: Client selected another agency due to pricing
 *     responses:
 *       200:
 *         description: Stage transitioned successfully, history updated
 *       400:
 *         description: Illegal stage jump, missing lostReason, or closed deal
 */
router.put('/:id/status', protect, checkPermission('businessDevAccess'), updateEnquiryStatus);

/**
 * @swagger
 * /enquiries/{id}/activity:
 *   post:
 *     summary: Append activity log entry (Call, Email, Meeting, Note)
 *     tags: [Business Development (CRM)]
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
 *             required:
 *               - type
 *               - description
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [Call, Email, Meeting, Note]
 *                 example: Call
 *               description:
 *                 type: string
 *                 example: Follow-up call regarding proposal pricing details.
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Activity logged
 */
router.post('/:id/activity', protect, checkPermission('businessDevAccess'), addActivityLog);

/**
 * @swagger
 * /enquiries/{id}/activity:
 *   get:
 *     summary: Get enquiry activity logs (most recent first)
 *     tags: [Business Development (CRM)]
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
 *         description: Array of activity log entries
 */
router.get('/:id/activity', protect, bdOrDirectorAccess, getActivityLogs);

/**
 * @swagger
 * /enquiries/{id}/attachments:
 *   post:
 *     summary: Add attachment file URL to enquiry activity history
 *     tags: [Business Development (CRM)]
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
 *             required:
 *               - fileUrl
 *             properties:
 *               fileUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Attachment added to enquiry
 */
router.post('/:id/attachments', protect, checkPermission('businessDevAccess'), addEnquiryAttachment);

/**
 * @swagger
 * /enquiries/{id}/convert:
 *   post:
 *     summary: Convert Won enquiry to Client & Project payload (Module 5 Handoff)
 *     tags: [Business Development (CRM)]
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
 *         description: Client resolved/created and suggested project payload returned
 *       400:
 *         description: Enquiry not in 'Won' status
 */
router.post('/:id/convert', protect, checkPermission('businessDevAccess'), convertEnquiry);

/**
 * @swagger
 * /enquiries/{id}/mark-converted:
 *   put:
 *     summary: Mark enquiry converted after Module 5 Project creation
 *     tags: [Business Development (CRM)]
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
 *             required:
 *               - projectId
 *             properties:
 *               projectId:
 *                 type: string
 *                 description: ObjectId of newly created Project from Module 5
 *     responses:
 *       200:
 *         description: Enquiry status updated to 'Project Creation'
 *       400:
 *         description: Enquiry not in 'Won' status or already converted
 */
router.put('/:id/mark-converted', protect, checkPermission('businessDevAccess'), markConverted);

module.exports = router;
