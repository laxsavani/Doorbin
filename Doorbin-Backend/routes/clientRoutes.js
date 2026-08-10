const express = require('express');
const router = express.Router();
const {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  addContact,
  updateContact,
  deleteContact,
  addCommunicationLog,
  getCommunicationLogs,
  getClientProjects,
  getClientPayments,
  getClientStatement
} = require('../controllers/clientController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

const clientReadAccess = (req, res, next) => {
  const p = req.user?.role?.permissions;
  if (p?.businessDevAccess || p?.projectManagement || p?.financeAccess || p?.userManagement) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Insufficient permissions to view client records.' });
};

const financeAccessOrDirector = (req, res, next) => {
  const p = req.user?.role?.permissions;
  if (p?.financeAccess || p?.userManagement) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Financial access permission required.' });
};

/**
 * @swagger
 * tags:
 *   name: Client Management
 *   description: Client Database, Multi-Contact, Communication Logs & Financial Summary APIs
 */

/**
 * @swagger
 * /clients:
 *   post:
 *     summary: Create a new client record
 *     tags: [Client Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *               - clientName
 *               - email
 *               - phone
 *             properties:
 *               companyName:
 *                 type: string
 *                 example: Sunrise Developers Pvt Ltd
 *               clientName:
 *                 type: string
 *                 example: Rajesh Sharma
 *               email:
 *                 type: string
 *                 example: rajesh@sunrisedev.com
 *               phone:
 *                 type: string
 *                 example: "+91 9876543210"
 *               address:
 *                 type: string
 *                 example: 101 Corporate Park, SG Highway, Ahmedabad
 *               gstDetails:
 *                 type: string
 *                 example: 24AAAAA0000A1Z5
 *               industry:
 *                 type: string
 *                 example: Real Estate
 *               notes:
 *                 type: string
 *                 example: Prefers WhatsApp for project updates
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                   properties:
 *                     name:
 *                       type: string
 *                     designation:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *     responses:
 *       201:
 *         description: Client created successfully
 *       400:
 *         description: Validation error or invalid GSTIN format
 *       403:
 *         description: BD Manager or Director permission required
 */
router.post('/', protect, checkPermission('businessDevAccess'), createClient);

/**
 * @swagger
 * /clients:
 *   get:
 *     summary: List clients with text search & filters
 *     tags: [Client Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by companyName, clientName, or email
 *       - in: query
 *         name: industry
 *         schema:
 *           type: string
 *         description: Filter by industry
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Active, Inactive, all]
 *         description: Filter by status (default Active)
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
 *         description: Paginated list of clients
 */
router.get('/', protect, clientReadAccess, getClients);

/**
 * @swagger
 * /clients/{id}:
 *   get:
 *     summary: Get single client details
 *     tags: [Client Management]
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
 *         description: Full client profile details
 *       404:
 *         description: Client not found
 */
router.get('/:id', protect, clientReadAccess, getClientById);

/**
 * @swagger
 * /clients/{id}:
 *   put:
 *     summary: Update client details
 *     tags: [Client Management]
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
 *               companyName:
 *                 type: string
 *               clientName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               gstDetails:
 *                 type: string
 *               industry:
 *                 type: string
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [Active, Inactive]
 *     responses:
 *       200:
 *         description: Client updated successfully
 *       403:
 *         description: BD Manager or Director permission required
 */
router.put('/:id', protect, checkPermission('businessDevAccess'), updateClient);

/**
 * @swagger
 * /clients/{id}:
 *   delete:
 *     summary: Soft-delete client (sets status to Inactive - Director ONLY)
 *     tags: [Client Management]
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
 *         description: Client soft-deleted (deactivated)
 *       403:
 *         description: Director role privileges required
 */
router.delete('/:id', protect, checkPermission('businessDevAccess'), deleteClient);

/**
 * @swagger
 * /clients/{id}/contacts:
 *   post:
 *     summary: Add an additional contact person to a client
 *     tags: [Client Management]
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Amit Patel
 *               designation:
 *                 type: string
 *                 example: Site Engineer
 *               email:
 *                 type: string
 *                 example: amit@sunrisedev.com
 *               phone:
 *                 type: string
 *                 example: "+91 9123456789"
 *     responses:
 *       201:
 *         description: Contact added, returns updated contacts array
 */
router.post('/:id/contacts', protect, checkPermission('businessDevAccess'), addContact);

/**
 * @swagger
 * /clients/{id}/contacts/{contactId}:
 *   put:
 *     summary: Update an additional contact person
 *     tags: [Client Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: contactId
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
 *               name:
 *                 type: string
 *               designation:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contact updated
 */
router.put('/:id/contacts/:contactId', protect, checkPermission('businessDevAccess'), updateContact);

/**
 * @swagger
 * /clients/{id}/contacts/{contactId}:
 *   delete:
 *     summary: Remove a contact person from client
 *     tags: [Client Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact removed
 */
router.delete('/:id/contacts/:contactId', protect, checkPermission('businessDevAccess'), deleteContact);

/**
 * @swagger
 * /clients/{id}/communication:
 *   post:
 *     summary: Log a client communication entry (Call, Email, Meeting, Note)
 *     tags: [Client Management]
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
 *                 example: Meeting
 *               description:
 *                 type: string
 *                 example: Initial discovery call to discuss 3D exterior renders for Phase 2.
 *     responses:
 *       201:
 *         description: Communication entry logged
 */
router.post('/:id/communication', protect, clientReadAccess, addCommunicationLog);

/**
 * @swagger
 * /clients/{id}/communication:
 *   get:
 *     summary: Get client communication log entries (most recent first)
 *     tags: [Client Management]
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
 *         description: Array of communication log entries
 */
router.get('/:id/communication', protect, clientReadAccess, getCommunicationLogs);

/**
 * @swagger
 * /clients/{id}/projects:
 *   get:
 *     summary: Get projects linked to client (Cross-Module 5 Stub)
 *     tags: [Client Management]
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
 *         description: Array of linked project records
 */
router.get('/:id/projects', protect, clientReadAccess, getClientProjects);

/**
 * @swagger
 * /clients/{id}/payments:
 *   get:
 *     summary: Get payments linked to client (Cross-Module 9 Stub)
 *     tags: [Client Management]
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
 *         description: Array of payment records
 *       403:
 *         description: Finance access required
 */
router.get('/:id/payments', protect, financeAccessOrDirector, getClientPayments);

/**
 * @swagger
 * /clients/{id}/statement:
 *   get:
 *     summary: Financial summary statement for client (Cross-Module 9 Stub)
 *     tags: [Client Management]
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
 *         description: Client financial statement summary
 *       403:
 *         description: Finance access required
 */
router.get('/:id/statement', protect, financeAccessOrDirector, getClientStatement);

module.exports = router;
