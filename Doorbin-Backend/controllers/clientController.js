const Client = require('../models/Client');
const logActivity = require('../utils/activityLogger');
const mongoose = require('mongoose');

// Helper to validate Indian GSTIN format (15-character alphanumeric)
const isValidGSTIN = (gst) => {
  if (!gst || !gst.trim()) return true; // Optional field
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gst.trim().toUpperCase());
};

// @desc    Create a new client
// @route   POST /api/clients
// @access  Private (BD Manager / Director - businessDevAccess)
const createClient = async (req, res) => {
  const { companyName, clientName, email, phone, address, gstDetails, industry, contacts, notes } = req.body;

  if (!companyName || !companyName.trim()) {
    return res.status(400).json({ message: 'Company name is required' });
  }
  if (!clientName || !clientName.trim()) {
    return res.status(400).json({ message: 'Primary client name is required' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Primary contact email is required' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ message: 'Primary contact phone is required' });
  }

  if (gstDetails && !isValidGSTIN(gstDetails)) {
    return res.status(400).json({
      message: 'Invalid GSTIN format. Must be a 15-character alphanumeric code (e.g. 22AAAAA0000A1Z5).'
    });
  }

  try {
    const client = await Client.create({
      companyName: companyName.trim(),
      clientName: clientName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      address,
      gstDetails: gstDetails ? gstDetails.trim().toUpperCase() : undefined,
      industry: industry ? industry.trim() : undefined,
      contacts: Array.isArray(contacts) ? contacts : [],
      notes,
      communicationLog: [],
      createdBy: req.user._id
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'CLIENT_CREATED',
      targetType: 'Client',
      targetId: client._id,
      metadata: { companyName: client.companyName }
    });

    const populatedClient = await Client.findById(client._id).populate('createdBy', 'name email role');
    return res.status(201).json(populatedClient);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get paginated client list with search & filters
// @route   GET /api/clients
// @access  Private (BD Manager, PM, Finance, Director)
const getClients = async (req, res) => {
  try {
    const { search, industry, status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    } else if (!status) {
      query.status = 'Active'; // Default to active clients
    }

    if (industry) {
      query.industry = new RegExp(`^${industry}$`, 'i');
    }

    if (search && search.trim()) {
      query.$text = { $search: search.trim() };
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [total, clients] = await Promise.all([
      Client.countDocuments(query),
      Client.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    return res.json({
      clients,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get single client details
// @route   GET /api/clients/:id
// @access  Private (BD Manager, PM, Finance, Director)
const getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('createdBy', 'name email phone role')
      .populate('communicationLog.createdBy', 'name email');

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    return res.json(client);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update client details
// @route   PUT /api/clients/:id
// @access  Private (BD Manager / Director - businessDevAccess)
const updateClient = async (req, res) => {
  const { companyName, clientName, email, phone, address, gstDetails, industry, notes, status } = req.body;

  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (gstDetails !== undefined && gstDetails && !isValidGSTIN(gstDetails)) {
      return res.status(400).json({
        message: 'Invalid GSTIN format. Must be a 15-character alphanumeric code (e.g. 22AAAAA0000A1Z5).'
      });
    }

    if (companyName !== undefined) client.companyName = companyName.trim();
    if (clientName !== undefined) client.clientName = clientName.trim();
    if (email !== undefined) client.email = email.trim().toLowerCase();
    if (phone !== undefined) client.phone = phone.trim();
    if (address !== undefined) client.address = address;
    if (gstDetails !== undefined) client.gstDetails = gstDetails ? gstDetails.trim().toUpperCase() : undefined;
    if (industry !== undefined) client.industry = industry;
    if (notes !== undefined) client.notes = notes;
    if (status && ['Active', 'Inactive'].includes(status)) client.status = status;

    const updatedClient = await client.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'CLIENT_UPDATED',
      targetType: 'Client',
      targetId: updatedClient._id,
      metadata: { companyName: updatedClient.companyName }
    });

    const populatedClient = await Client.findById(updatedClient._id)
      .populate('createdBy', 'name email role')
      .populate('communicationLog.createdBy', 'name email');

    return res.json(populatedClient);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Soft-delete client (sets status to 'Inactive')
// @route   DELETE /api/clients/:id
// @access  Private (Director ONLY - double gated)
const deleteClient = async (req, res) => {
  try {
    // Double-gate check: must be explicit Director role
    const isDirector = req.user?.role?.name === 'Director';
    if (!isDirector) {
      return res.status(403).json({
        message: 'Access denied: Soft-deleting a client requires explicit Director privileges.'
      });
    }

    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    client.status = 'Inactive';
    await client.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'CLIENT_DEACTIVATED',
      targetType: 'Client',
      targetId: client._id,
      metadata: { companyName: client.companyName }
    });

    return res.json({ message: `Client '${client.companyName}' deactivated successfully (soft-deleted).` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Add additional contact to client
// @route   POST /api/clients/:id/contacts
// @access  Private (BD Manager / Director - businessDevAccess)
const addContact = async (req, res) => {
  const { name, designation, email, phone } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Contact name is required' });
  }

  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    client.contacts.push({ name: name.trim(), designation, email, phone });
    await client.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'CLIENT_CONTACT_ADDED',
      targetType: 'Client',
      targetId: client._id,
      metadata: { contactName: name }
    });

    return res.status(201).json(client.contacts);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update specific contact on client
// @route   PUT /api/clients/:id/contacts/:contactId
// @access  Private (BD Manager / Director - businessDevAccess)
const updateContact = async (req, res) => {
  const { name, designation, email, phone } = req.body;

  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const contact = client.contacts.id(req.params.contactId);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (name !== undefined) contact.name = name.trim();
    if (designation !== undefined) contact.designation = designation;
    if (email !== undefined) contact.email = email;
    if (phone !== undefined) contact.phone = phone;

    await client.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'CLIENT_CONTACT_UPDATED',
      targetType: 'Client',
      targetId: client._id,
      metadata: { contactId: req.params.contactId }
    });

    return res.json(client.contacts);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Remove contact from client
// @route   DELETE /api/clients/:id/contacts/:contactId
// @access  Private (BD Manager / Director - businessDevAccess)
const deleteContact = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const contact = client.contacts.id(req.params.contactId);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    client.contacts.pull(req.params.contactId);
    await client.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'CLIENT_CONTACT_DELETED',
      targetType: 'Client',
      targetId: client._id,
      metadata: { contactId: req.params.contactId }
    });

    return res.json(client.contacts);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Add entry to client communication log
// @route   POST /api/clients/:id/communication
// @access  Private (BD Manager / Director)
const addCommunicationLog = async (req, res) => {
  const { type, description } = req.body;

  if (!type || !['Call', 'Email', 'Meeting', 'Note'].includes(type)) {
    return res.status(400).json({ message: 'Valid communication type (Call, Email, Meeting, Note) is required' });
  }
  if (!description || !description.trim()) {
    return res.status(400).json({ message: 'Communication description is required' });
  }

  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    client.communicationLog.push({
      type,
      description: description.trim(),
      date: new Date(),
      createdBy: req.user._id
    });

    await client.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'CLIENT_COMMUNICATION_LOGGED',
      targetType: 'Client',
      targetId: client._id,
      metadata: { logType: type }
    });

    const updatedClient = await Client.findById(client._id).populate('communicationLog.createdBy', 'name email');
    return res.status(201).json(updatedClient.communicationLog);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get client communication logs (most recent first)
// @route   GET /api/clients/:id/communication
// @access  Private (BD Manager, PM, Finance, Director)
const getCommunicationLogs = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).populate('communicationLog.createdBy', 'name email');
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const sortedLogs = [...client.communicationLog].sort((a, b) => b.date - a.date);
    return res.json(sortedLogs);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get projects associated with client (Cross-Module 5 Stub)
// @route   GET /api/clients/:id/projects
// @access  Private (BD Manager, PM, Finance, Director)
const getClientProjects = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Check if Project model exists (Module 5)
    if (mongoose.models.Project) {
      const projects = await mongoose.models.Project.find({ client: client._id });
      return res.json(projects);
    }

    // Stub return until Module 5 is implemented
    return res.json([]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get payments associated with client (Module 9 Integration)
// @route   GET /api/clients/:id/payments
// @access  Private (Finance / Director - financeAccess)
const getClientPayments = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (mongoose.models.Payment) {
      const payments = await mongoose.models.Payment.find({ client: client._id })
        .populate('invoice', 'invoiceNumber totalAmount status')
        .populate('receivedBy', 'name email')
        .sort({ paymentDate: -1 });

      const { formatDDMMYYYY } = require('../utils/dateFormatter');

      const formatted = payments.map(p => ({
        ...p.toObject(),
        paymentDateFormatted: formatDDMMYYYY(p.paymentDate)
      }));

      return res.json(formatted);
    }

    return res.json([]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get client financial statement summary (Module 9 Integration)
// @route   GET /api/clients/:id/statement
// @access  Private (Finance / Director - financeAccess)
const getClientStatement = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const { formatDDMMYYYY } = require('../utils/dateFormatter');

    const Quotation = mongoose.models.Quotation;
    const Invoice = mongoose.models.Invoice;
    const Payment = mongoose.models.Payment;

    const [quotations, invoices, payments] = await Promise.all([
      Quotation ? Quotation.find({ client: client._id }).sort({ date: -1 }).lean() : Promise.resolve([]),
      Invoice ? Invoice.find({ client: client._id }).sort({ issueDate: -1 }).lean() : Promise.resolve([]),
      Payment ? Payment.find({ client: client._id }).sort({ paymentDate: -1 }).lean() : Promise.resolve([])
    ]);

    const totalQuoted = quotations.reduce((sum, q) => sum + (q.amount || 0), 0);
    const totalInvoiced = invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);

    const outstandingBalance = Math.max(0, Number((totalInvoiced - totalPaid).toFixed(2)));

    return res.json({
      client: {
        _id: client._id,
        companyName: client.companyName,
        clientName: client.clientName,
        email: client.email,
        gstDetails: client.gstDetails
      },
      dateFormat: 'DD/MM/YYYY',
      financialSummary: {
        totalQuoted: Number(totalQuoted.toFixed(2)),
        totalInvoiced: Number(totalInvoiced.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
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

module.exports = {
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
};
