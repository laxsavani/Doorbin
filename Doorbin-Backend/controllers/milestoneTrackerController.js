const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const ProjectMilestonePayment = require('../models/ProjectMilestonePayment');
const Project = require('../models/Project');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const FinanceSettings = require('../models/FinanceSettings');
const FinanceCounter = require('../models/FinanceCounter');
const logActivity = require('../utils/activityLogger');
const { computeMilestoneRollup } = require('../utils/milestoneCalc');

// Helper to format date as dd-mmm-yy (e.g., 10-Apr-26)
const formatDDMMMYY = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

// Helper to generate official Invoice Number
const generateInvoiceDocNumber = async () => {
  const d = new Date();
  const month = d.getMonth();
  const year = d.getFullYear();
  let startYear = year;
  if (month < 3) startYear = year - 1;
  const fy = `${startYear}-${String(startYear + 1).slice(-2)}`;

  const counter = await FinanceCounter.findOneAndUpdate(
    { fy, type: 'Invoice' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );

  let settings = await FinanceSettings.findOne({});
  const fmt = settings?.invoiceNumberFormat || 'DV/INV/{FY}/{SEQ}';
  const seqPadded = String(counter.seq).padStart(4, '0');
  return fmt.replace('{FY}', fy).replace('{SEQ}', seqPadded);
};

// Helper: Process milestone status transitions (WIP -> Auto-Invoice, Received -> Auto-Payment Receipt)
const syncMilestoneFinanceDocuments = async (proj, milestoneItem, userId) => {
  if (!milestoneItem || !proj) return milestoneItem;

  const mNum = milestoneItem.milestoneNumber;
  const amt = milestoneItem.amount != null ? Number(milestoneItem.amount) : 0;
  const st = milestoneItem.status || 'Due';

  let linkedInvoice = null;

  // 1. Check or fetch existing Invoice for this Project & Milestone
  if (milestoneItem.invoice) {
    linkedInvoice = await Invoice.findById(milestoneItem.invoice);
  }
  if (!linkedInvoice) {
    linkedInvoice = await Invoice.findOne({
      project: proj._id,
      notes: { $regex: `Milestone ${mNum}` }
    });
  }

  // 2. If status is 'WIP' or 'Received', AUTO-GENERATE INVOICE if not exists
  if ((st === 'WIP' || st === 'Received') && !linkedInvoice) {
    const invNum = await generateInvoiceDocNumber();
    const issueD = new Date();
    const dueD = new Date(issueD.getTime() + 15 * 86400000);

    linkedInvoice = await Invoice.create({
      client: proj.client?._id || proj.client,
      project: proj._id,
      invoiceNumber: invNum,
      amount: amt,
      gstRate: 0,
      gst: 0,
      totalAmount: amt,
      issueDate: issueD,
      dueDate: dueD,
      status: st === 'Received' ? 'Paid' : 'Pending',
      notes: `Auto-generated Invoice for Milestone ${mNum} (${proj.projectName})`,
      createdBy: userId
    });

    milestoneItem.invoice = linkedInvoice._id;

    await logActivity({
      req: null,
      userId,
      action: 'INVOICE_AUTO_GENERATED_FROM_MILESTONE',
      targetType: 'Invoice',
      targetId: linkedInvoice._id,
      metadata: { invoiceNumber: invNum, milestoneNumber: mNum, projectName: proj.projectName }
    });
  }

  // 3. If status is 'Received', AUTO-GENERATE PAYMENT RECEIPT if not exists
  if (st === 'Received' && linkedInvoice) {
    let linkedPayment = null;
    if (milestoneItem.payment) {
      linkedPayment = await Payment.findById(milestoneItem.payment);
    }
    if (!linkedPayment) {
      linkedPayment = await Payment.findOne({ invoice: linkedInvoice._id });
    }

    if (!linkedPayment) {
      const payAmount = linkedInvoice.totalAmount || amt;
      const payDate = milestoneItem.dateReceived ? new Date(milestoneItem.dateReceived) : new Date();

      linkedPayment = await Payment.create({
        invoice: linkedInvoice._id,
        client: proj.client?._id || proj.client,
        amountPaid: payAmount,
        paymentDate: payDate,
        paymentMode: 'Bank Transfer',
        referenceNumber: `REC-M${mNum}-${Date.now().toString().slice(-6)}`,
        notes: `Auto-generated Payment Receipt for Milestone ${mNum} (${proj.projectName})`,
        receivedBy: userId,
        createdBy: userId
      });

      milestoneItem.payment = linkedPayment._id;

      // Update Invoice status to Paid
      linkedInvoice.status = 'Paid';
      await linkedInvoice.save();

      await logActivity({
        req: null,
        userId,
        action: 'PAYMENT_RECEIPT_AUTO_GENERATED_FROM_MILESTONE',
        targetType: 'Payment',
        targetId: linkedPayment._id,
        metadata: { paymentId: linkedPayment._id, invoiceNumber: linkedInvoice.invoiceNumber, milestoneNumber: mNum }
      });
    }
  }

  return milestoneItem;
};

// @desc    Get all milestone payment trackers (paginated & computed)
// @route   GET /api/finance/milestone-tracker
// @access  Private (financeAccess)
const getTrackers = async (req, res) => {
  try {
    const { projectStatus, client, search, page = 1, limit = 50 } = req.query;

    const projectQuery = {};
    if (projectStatus && projectStatus !== 'all') {
      projectQuery.status = projectStatus;
    }
    if (client && client !== 'all') {
      projectQuery.client = client;
    }
    if (search && search.trim()) {
      projectQuery.projectName = { $regex: search.trim(), $options: 'i' };
    }

    const projects = await Project.find(projectQuery)
      .populate('client', 'clientName companyName')
      .populate('productionManager', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const projectIds = projects.map(p => p._id);
    const existingTrackers = await ProjectMilestonePayment.find({ project: { $in: projectIds } }).lean();
    const trackerMap = new Map(existingTrackers.map(t => [t.project.toString(), t]));

    const allRollups = projects.map((proj, idx) => {
      const trackerDoc = trackerMap.get(proj._id.toString()) || {
        _id: null,
        project: proj._id,
        architectDesigner: '',
        milestones: [],
        notes: ''
      };

      const rollup = computeMilestoneRollup(trackerDoc, proj);

      const clientName = typeof proj.client === 'object'
        ? (proj.client?.companyName || proj.client?.clientName || 'N/A')
        : 'N/A';

      return {
        _id: trackerDoc._id,
        srNo: idx + 1,
        project: {
          _id: proj._id,
          projectName: proj.projectName,
          projectCode: proj.projectCode,
          status: proj.status || 'In Progress',
          budget: proj.budget || null,
          client: proj.client
        },
        clientName,
        architectDesigner: trackerDoc.architectDesigner || '',
        notes: trackerDoc.notes || '',
        ...rollup
      };
    });

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = allRollups.slice(startIndex, startIndex + limitNum);

    return res.json({
      success: true,
      totalCount: allRollups.length,
      page: pageNum,
      totalPages: Math.ceil(allRollups.length / limitNum) || 1,
      data: paginatedItems
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single project milestone payment tracker
// @route   GET /api/finance/milestone-tracker/:projectId
// @access  Private (financeAccess)
const getTrackerByProject = async (req, res) => {
  const { projectId } = req.params;
  try {
    const proj = await Project.findById(projectId).populate('client', 'clientName companyName');
    if (!proj) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    let trackerDoc = await ProjectMilestonePayment.findOne({ project: projectId });
    if (!trackerDoc) {
      trackerDoc = {
        _id: null,
        project: proj._id,
        architectDesigner: '',
        milestones: [],
        notes: ''
      };
    }

    const rollup = computeMilestoneRollup(trackerDoc, proj);
    const clientName = typeof proj.client === 'object'
      ? (proj.client?.companyName || proj.client?.clientName || 'N/A')
      : 'N/A';

    return res.json({
      success: true,
      data: {
        _id: trackerDoc._id,
        project: {
          _id: proj._id,
          projectName: proj.projectName,
          projectCode: proj.projectCode,
          status: proj.status || 'In Progress',
          budget: proj.budget || null,
          client: proj.client
        },
        clientName,
        architectDesigner: trackerDoc.architectDesigner || '',
        notes: trackerDoc.notes || '',
        ...rollup
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new milestone payment tracker for project
// @route   POST /api/finance/milestone-tracker
// @access  Private (financeAccess)
const createTracker = async (req, res) => {
  const { project: projectId, architectDesigner, milestones = [], notes } = req.body;

  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ success: false, message: 'Valid Project ID is required' });
  }

  try {
    const proj = await Project.findById(projectId);
    if (!proj) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const existing = await ProjectMilestonePayment.findOne({ project: projectId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Milestone payment tracker already exists for this project. Use PUT to update.' });
    }

    const processedMilestones = [];
    for (const m of milestones) {
      let st = m.status || 'Due';
      if (m.dateReceived && !m.status) st = 'Received';

      const item = {
        milestoneNumber: Number(m.milestoneNumber),
        amount: m.amount != null && m.amount !== '' ? Number(m.amount) : null,
        dateReceived: m.dateReceived ? new Date(m.dateReceived) : null,
        status: st
      };

      const syncedItem = await syncMilestoneFinanceDocuments(proj, item, req.user._id);
      processedMilestones.push(syncedItem);
    }

    const newDoc = await ProjectMilestonePayment.create({
      project: projectId,
      architectDesigner: architectDesigner || '',
      milestones: processedMilestones,
      notes: notes || '',
      createdBy: req.user._id
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'MILESTONE_TRACKER_CREATED',
      targetType: 'ProjectMilestonePayment',
      targetId: newDoc._id,
      metadata: { projectId }
    });

    const rollup = computeMilestoneRollup(newDoc, proj);
    return res.status(201).json({
      success: true,
      message: 'Milestone payment tracker created successfully',
      data: {
        _id: newDoc._id,
        project: proj,
        architectDesigner: newDoc.architectDesigner,
        notes: newDoc.notes,
        ...rollup
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update milestone payment tracker
// @route   PUT /api/finance/milestone-tracker/:projectId
// @access  Private (financeAccess)
const updateTracker = async (req, res) => {
  const { projectId } = req.params;
  const { architectDesigner, milestones, notes } = req.body;

  try {
    const proj = await Project.findById(projectId);
    if (!proj) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    let trackerDoc = await ProjectMilestonePayment.findOne({ project: projectId });

    let processedMilestones = undefined;
    if (Array.isArray(milestones)) {
      processedMilestones = [];
      for (const m of milestones) {
        let st = m.status || 'Due';
        if (m.dateReceived && !m.status) st = 'Received';

        const existingItem = trackerDoc?.milestones?.find(item => item.milestoneNumber === Number(m.milestoneNumber));

        const item = {
          milestoneNumber: Number(m.milestoneNumber),
          amount: m.amount != null && m.amount !== '' ? Number(m.amount) : null,
          dateReceived: m.dateReceived ? new Date(m.dateReceived) : null,
          status: st,
          invoice: existingItem?.invoice || null,
          payment: existingItem?.payment || null
        };

        const syncedItem = await syncMilestoneFinanceDocuments(proj, item, req.user._id);
        processedMilestones.push(syncedItem);
      }
    }

    if (!trackerDoc) {
      trackerDoc = await ProjectMilestonePayment.create({
        project: projectId,
        architectDesigner: architectDesigner || '',
        milestones: processedMilestones || [],
        notes: notes || '',
        createdBy: req.user._id
      });
    } else {
      if (architectDesigner !== undefined) trackerDoc.architectDesigner = architectDesigner;
      if (processedMilestones !== undefined) trackerDoc.milestones = processedMilestones;
      if (notes !== undefined) trackerDoc.notes = notes;
      trackerDoc.updatedBy = req.user._id;
      await trackerDoc.save();
    }

    await logActivity({
      req,
      userId: req.user._id,
      action: 'MILESTONE_TRACKER_UPDATED',
      targetType: 'ProjectMilestonePayment',
      targetId: trackerDoc._id,
      metadata: { projectId }
    });

    const rollup = computeMilestoneRollup(trackerDoc, proj);
    return res.json({
      success: true,
      message: 'Milestone payment tracker updated successfully',
      data: {
        _id: trackerDoc._id,
        project: proj,
        architectDesigner: trackerDoc.architectDesigner,
        notes: trackerDoc.notes,
        ...rollup
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update single milestone cell (inline table editing)
// @route   PUT /api/finance/milestone-tracker/:projectId/milestone/:milestoneNumber
// @access  Private (financeAccess)
const updateSingleMilestone = async (req, res) => {
  const { projectId, milestoneNumber } = req.params;
  const { amount, dateReceived, status } = req.body;
  const mNum = parseInt(milestoneNumber, 10);

  if (isNaN(mNum) || mNum < 1 || mNum > 5) {
    return res.status(400).json({ success: false, message: 'Milestone number must be between 1 and 5' });
  }

  try {
    const proj = await Project.findById(projectId);
    if (!proj) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    let trackerDoc = await ProjectMilestonePayment.findOne({ project: projectId });

    if (!trackerDoc) {
      trackerDoc = new ProjectMilestonePayment({
        project: projectId,
        milestones: [],
        createdBy: req.user._id
      });
    }

    const existingIdx = trackerDoc.milestones.findIndex(m => m.milestoneNumber === mNum);
    let newStatus = status;
    if (dateReceived && !status) {
      newStatus = 'Received';
    }

    let milestoneItem = {
      milestoneNumber: mNum,
      amount: amount !== undefined ? (amount != null && amount !== '' ? Number(amount) : null) : (existingIdx >= 0 ? trackerDoc.milestones[existingIdx].amount : null),
      dateReceived: dateReceived !== undefined ? (dateReceived ? new Date(dateReceived) : null) : (existingIdx >= 0 ? trackerDoc.milestones[existingIdx].dateReceived : null),
      status: newStatus || (existingIdx >= 0 ? trackerDoc.milestones[existingIdx].status : 'Due'),
      invoice: existingIdx >= 0 ? trackerDoc.milestones[existingIdx].invoice : null,
      payment: existingIdx >= 0 ? trackerDoc.milestones[existingIdx].payment : null
    };

    milestoneItem = await syncMilestoneFinanceDocuments(proj, milestoneItem, req.user._id);

    if (existingIdx >= 0) {
      trackerDoc.milestones[existingIdx] = milestoneItem;
    } else {
      trackerDoc.milestones.push(milestoneItem);
    }

    trackerDoc.updatedBy = req.user._id;
    await trackerDoc.save();

    const rollup = computeMilestoneRollup(trackerDoc, proj);
    return res.json({
      success: true,
      message: `Milestone ${mNum} updated successfully`,
      data: {
        _id: trackerDoc._id,
        project: proj,
        architectDesigner: trackerDoc.architectDesigner,
        notes: trackerDoc.notes,
        ...rollup
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete milestone tracker document
// @route   DELETE /api/finance/milestone-tracker/:projectId
// @access  Private (Director role)
const deleteTracker = async (req, res) => {
  const { projectId } = req.params;
  try {
    const trackerDoc = await ProjectMilestonePayment.findOneAndDelete({ project: projectId });
    if (!trackerDoc) {
      return res.status(404).json({ success: false, message: 'Milestone payment tracker not found' });
    }

    await logActivity({
      req,
      userId: req.user._id,
      action: 'MILESTONE_TRACKER_DELETED',
      targetType: 'ProjectMilestonePayment',
      targetId: trackerDoc._id,
      metadata: { projectId }
    });

    return res.json({ success: true, message: 'Milestone payment tracker deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk Upload Milestone Trackers from Excel/CSV
// @route   POST /api/finance/milestone-tracker/bulk-upload
// @access  Private (financeAccess)
// Safe helper to extract primitive string/date from any ExcelJS cell (handling hyperlinks, formulas, richText)
const getSafeCellText = (cell) => {
  if (!cell) return '';
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val instanceof Date) return val;
    if (val.text) return String(val.text).trim();
    if (val.result !== undefined) return String(val.result).trim();
    if (val.richText && Array.isArray(val.richText)) return val.richText.map(t => t.text || '').join('').trim();
  }
  return String(val).trim();
};

// Robust date parser supporting '10-Apr-26', '12-May-2028', '15/08/2026', '2026-08-15', and Excel serial dates
const parseCustomDateValue = (val) => {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  const str = String(val).trim();
  if (!str || str === '-' || str === '.') return null;

  // Handle format like "10-Apr-26" or "12-May-2028"
  const mmmMatch = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,4})[-/ ](\d{2,4})$/);
  if (mmmMatch) {
    const day = parseInt(mmmMatch[1], 10);
    const mStr = mmmMatch[2].toLowerCase();
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const month = months[mStr.slice(0, 3)];
    let yr = parseInt(mmmMatch[3], 10);
    if (yr < 100) yr += 2000;
    if (month !== undefined) {
      return new Date(yr, month, day, 12, 0, 0);
    }
  }

  // Handle format like "15/08/2026" or "15-08-2026"
  const ddmmyyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (ddmmyyMatch) {
    const day = parseInt(ddmmyyMatch[1], 10);
    const month = parseInt(ddmmyyMatch[2], 10) - 1;
    let yr = parseInt(ddmmyyMatch[3], 10);
    if (yr < 100) yr += 2000;
    return new Date(yr, month, day, 12, 0, 0);
  }

  const pd = new Date(str);
  if (!isNaN(pd.getTime())) return pd;
  return null;
};

const bulkUploadTrackers = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload an Excel (.xlsx) or CSV file' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    if (req.file.originalname.endsWith('.csv')) {
      await workbook.csv.read(req.file.buffer);
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ success: false, message: 'Uploaded file has no readable worksheet' });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    const allProjects = await Project.find().populate('client', 'clientName companyName');
    const allClients = await Client.find();

    const rowsToProcess = [];
    worksheet.eachRow((row, rowNumber) => {
      // Header rows are typically row 1 and row 2 in the template
      if (rowNumber <= 2) return;
      rowsToProcess.push({ row, rowNumber });
    });

    for (const { row, rowNumber } of rowsToProcess) {
      // Direct cell extraction using 1-based column indexing
      // Col 1 (A): Sr No, Col 2 (B): Project Name, Col 3 (C): Client Name, Col 4 (D): Architect / Designer, Col 5 (E): Project Status
      const col1 = getSafeCellText(row.getCell(1));
      const col2 = getSafeCellText(row.getCell(2));
      const col3 = getSafeCellText(row.getCell(3));
      const col4 = getSafeCellText(row.getCell(4));
      const col5 = getSafeCellText(row.getCell(5));

      let projNameRaw = col2;
      let clientNameRaw = col3;

      // Handle fallback if Project Name is in Col 1 and Sr No was omitted
      if (!projNameRaw && col1 && isNaN(Number(col1)) && col1.toLowerCase() !== 'sr. no.') {
        projNameRaw = col1;
      }

      // Skip completely empty rows silently
      if (!projNameRaw && !clientNameRaw) {
        continue;
      }

      const lowerProjName = projNameRaw.toLowerCase().trim();

      // Skip repeated headers or summary/total rows
      if (
        lowerProjName === 'project name' ||
        lowerProjName === 'sr. no.' ||
        lowerProjName === 'sr.no.' ||
        lowerProjName === 'total' ||
        lowerProjName === 'grand total' ||
        lowerProjName.startsWith('total') ||
        lowerProjName === 'summary'
      ) {
        continue;
      }

      try {
        let matchedProjects = allProjects.filter(p => {
          const nameMatch = p.projectName.toLowerCase() === projNameRaw.toLowerCase();
          if (!nameMatch) return false;
          if (clientNameRaw) {
            const c = p.client;
            const cName = typeof c === 'object' ? (c?.companyName || c?.clientName || '') : '';
            return cName.toLowerCase().includes(clientNameRaw.toLowerCase());
          }
          return true;
        });

        let targetProject = matchedProjects[0];
        const archDesigner = col4;
        const projStatusRaw = col5;

        // 1. AUTO-CREATE CLIENT & PROJECT IF NOT IN DATABASE
        if (!targetProject) {
          let targetClient = allClients.find(c => {
            const cName = (c.companyName || c.clientName || '').toLowerCase();
            return clientNameRaw && cName.includes(clientNameRaw.toLowerCase());
          });

          if (!targetClient) {
            targetClient = await Client.create({
              companyName: clientNameRaw || `${projNameRaw} Client`,
              clientName: clientNameRaw || 'Direct Client',
              category: 'Client',
              directoryType: 'Client',
              industry: 'Architecture & Real Estate',
              status: 'Active'
            });
            allClients.push(targetClient);
          }

          let initialStatus = 'In Progress';
          if (['Not Started', 'In Progress', 'Completed', 'Delayed', 'On Hold'].includes(projStatusRaw)) {
            initialStatus = projStatusRaw;
          }

          targetProject = await Project.create({
            projectName: projNameRaw,
            client: targetClient._id,
            projectCategory: 'Architecture',
            status: initialStatus,
            architect: archDesigner || '',
            budget: 100000
          });
          allProjects.push(targetProject);
        } else {
          // Update architect or status if provided in sheet
          if (archDesigner && !targetProject.architect) {
            targetProject.architect = archDesigner;
            await targetProject.save();
          }
          if (projStatusRaw && ['Not Started', 'In Progress', 'Completed', 'Delayed', 'On Hold'].includes(projStatusRaw)) {
            targetProject.status = projStatusRaw;
            await targetProject.save();
          }
        }

        // 2. Parse 5 Milestones
        const parsedMilestones = [];
        let totalCalculatedAmount = 0;

        for (let mIdx = 0; mIdx < 5; mIdx++) {
          // In template:
          // M1: F (6), G (7 Amount), H (8 Date), I (9 Status)
          // M2: J (10), K (11 Amount), L (12 Date), M (13 Status)
          // M3: N (14), O (15 Amount), P (16 Date), Q (17 Status)
          // M4: R (18), S (19 Amount), T (20 Date), U (21 Status)
          // M5: V (22), W (23 Amount), X (24 Date), Y (25 Status)
          const baseCol = 6 + (mIdx * 4);
          const amountRaw = getSafeCellText(row.getCell(baseCol + 1));
          const dateRaw = getSafeCellText(row.getCell(baseCol + 2));
          const statusRaw = getSafeCellText(row.getCell(baseCol + 3));

          let numAmount = null;
          if (amountRaw != null && amountRaw !== '' && amountRaw !== '-') {
            const cleanAmt = String(amountRaw).replace(/[^0-9.]/g, '');
            numAmount = cleanAmt ? Number(cleanAmt) : null;
            if (numAmount) totalCalculatedAmount += numAmount;
          }

          const dateRec = parseCustomDateValue(dateRaw);

          let st = statusRaw ? String(statusRaw).trim() : 'Due';
          if (!['Due', 'WIP', 'Received'].includes(st)) {
            if (dateRec || (numAmount && st.toLowerCase().includes('rec'))) st = 'Received';
            else if (st.toLowerCase().includes('wip') || st.toLowerCase().includes('prog')) st = 'WIP';
            else st = 'Due';
          }

          parsedMilestones.push({
            milestoneNumber: mIdx + 1,
            amount: numAmount,
            dateReceived: dateRec,
            status: st
          });
        }

        // Update project budget if total parsed milestone value is higher
        if (totalCalculatedAmount > (targetProject.budget || 0)) {
          targetProject.budget = totalCalculatedAmount;
          await targetProject.save();
        }

        // Extract Notes from Column 31 (AE)
        const notesRaw = getSafeCellText(row.getCell(31));

        // 3. Upsert ProjectMilestonePayment document in MongoDB
        let trackerDoc = await ProjectMilestonePayment.findOne({ project: targetProject._id });
        if (!trackerDoc) {
          trackerDoc = new ProjectMilestonePayment({
            project: targetProject._id,
            architectDesigner: archDesigner || targetProject.architect || '',
            notes: notesRaw || '',
            milestones: parsedMilestones
          });
        } else {
          trackerDoc.architectDesigner = archDesigner || trackerDoc.architectDesigner || targetProject.architect || '';
          if (notesRaw) trackerDoc.notes = notesRaw;
          parsedMilestones.forEach(newM => {
            const existingM = trackerDoc.milestones.find(m => m.milestoneNumber === newM.milestoneNumber);
            if (existingM) {
              if (newM.amount !== null) existingM.amount = newM.amount;
              if (newM.dateReceived !== null) existingM.dateReceived = newM.dateReceived;
              if (newM.status) existingM.status = newM.status;
            } else {
              trackerDoc.milestones.push(newM);
            }
          });
        }

        await trackerDoc.save();

        successCount++;
        results.push({
          row: rowNumber,
          projectName: projNameRaw,
          status: 'success',
          message: `Successfully added & synced "${projNameRaw}" with ${parsedMilestones.filter(m => m.amount > 0).length} milestones`
        });
      } catch (rowErr) {
        console.error(`Error processing row ${rowNumber}:`, rowErr);
        errorCount++;
        results.push({
          row: rowNumber,
          projectName: projNameRaw,
          status: 'error',
          message: rowErr.message || 'Error parsing row data'
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Sheet processed successfully! ${successCount} project(s) added and synced to database.`,
      successCount,
      errorCount,
      skippedCount,
      results
    });
  } catch (err) {
    console.error('Error during bulk upload:', err);
    return res.status(500).json({ success: false, message: 'Server error processing upload file: ' + err.message });
  }
};

const exportTrackers = async (req, res) => {
  const { format = 'excel', projectStatus, client } = req.query;

  try {
    const projectQuery = {};
    if (projectStatus && projectStatus !== 'all') projectQuery.status = projectStatus;
    if (client && client !== 'all') projectQuery.client = client;

    const projects = await Project.find(projectQuery)
      .populate('client', 'clientName companyName')
      .sort({ createdAt: -1 });

    const projectIds = projects.map(p => p._id);
    const existingTrackers = await ProjectMilestonePayment.find({ project: { $in: projectIds } });
    const trackerMap = new Map(existingTrackers.map(t => [t.project.toString(), t]));

    const rollups = projects.map((proj, idx) => {
      const trackerDoc = trackerMap.get(proj._id.toString()) || {
        _id: null,
        project: proj._id,
        architectDesigner: '',
        milestones: [],
        notes: ''
      };

      const rollup = computeMilestoneRollup(trackerDoc, proj);
      const clientName = typeof proj.client === 'object'
        ? (proj.client?.companyName || proj.client?.clientName || 'N/A')
        : 'N/A';

      return {
        srNo: idx + 1,
        projectName: proj.projectName,
        clientName,
        architectDesigner: trackerDoc.architectDesigner || '',
        projectStatus: proj.status || 'In Progress',
        notes: trackerDoc.notes || '',
        ...rollup
      };
    });

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Milestone Payment Tracker');

      ws.getRow(1).values = [
        '', '', '', '', '',
        'Milestone 1', '', '', '',
        'Milestone 2', '', '', '',
        'Milestone 3', '', '', '',
        'Milestone 4', '', '', '',
        'Milestone 5', '', '', '',
        '', '', '', '', '', ''
      ];

      ws.mergeCells('F1:I1');
      ws.mergeCells('J1:M1');
      ws.mergeCells('N1:Q1');
      ws.mergeCells('R1:U1');
      ws.mergeCells('V1:Y1');

      ws.getRow(2).values = [
        'Sr. No.', 'Project Name', 'Client Name', 'Architect / Designer', 'Project Status',
        '%', 'Amount (₹)', 'Date Received', 'Status',
        '%', 'Amount (₹)', 'Date Received', 'Status',
        '%', 'Amount (₹)', 'Date Received', 'Status',
        '%', 'Amount (₹)', 'Date Received', 'Status',
        '%', 'Amount (₹)', 'Date Received', 'Status',
        '% Check', 'Total Project Value (₹)', 'Total Received (₹)', 'WIP (₹)', 'Balance Due (₹)', 'Notes'
      ];

      [1, 2].forEach(rNo => {
        const row = ws.getRow(rNo);
        row.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
        row.alignment = { vertical: 'middle', horizontal: 'center' };
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '475569' } };
        });
      });

      ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 2 }];

      rollups.forEach(r => {
        const rowData = [
          r.srNo,
          r.projectName,
          r.clientName,
          r.architectDesigner,
          r.projectStatus,
          r.milestones[0]?.percent != null ? r.milestones[0].percent : '',
          r.milestones[0]?.amount != null ? r.milestones[0].amount : '',
          formatDDMMMYY(r.milestones[0]?.dateReceived),
          r.milestones[0]?.status || 'Due',
          r.milestones[1]?.percent != null ? r.milestones[1].percent : '',
          r.milestones[1]?.amount != null ? r.milestones[1].amount : '',
          formatDDMMMYY(r.milestones[1]?.dateReceived),
          r.milestones[1]?.status || 'Due',
          r.milestones[2]?.percent != null ? r.milestones[2].percent : '',
          r.milestones[2]?.amount != null ? r.milestones[2].amount : '',
          formatDDMMMYY(r.milestones[2]?.dateReceived),
          r.milestones[2]?.status || 'Due',
          r.milestones[3]?.percent != null ? r.milestones[3].percent : '',
          r.milestones[3]?.amount != null ? r.milestones[3].amount : '',
          formatDDMMMYY(r.milestones[3]?.dateReceived),
          r.milestones[3]?.status || 'Due',
          r.milestones[4]?.percent != null ? r.milestones[4].percent : '',
          r.milestones[4]?.amount != null ? r.milestones[4].amount : '',
          formatDDMMMYY(r.milestones[4]?.dateReceived),
          r.milestones[4]?.status || 'Due',
          r.percentCheck != null ? r.percentCheck : '',
          r.totalProjectValue != null ? r.totalProjectValue : '',
          r.totalReceived,
          r.wip,
          r.balanceDue,
          r.notes
        ];

        const addedRow = ws.addRow(rowData);

        [6, 10, 14, 18, 22, 26].forEach(colIdx => {
          const cell = addedRow.getCell(colIdx);
          if (typeof cell.value === 'number') {
            cell.numFmt = '0%';
          }
        });

        [7, 11, 15, 19, 23, 27, 28, 29, 30].forEach(colIdx => {
          const cell = addedRow.getCell(colIdx);
          if (typeof cell.value === 'number') {
            cell.numFmt = '"₹"#,##0';
          }
        });

        [9, 13, 17, 21, 25].forEach(colIdx => {
          const cell = addedRow.getCell(colIdx);
          const st = String(cell.value);
          if (st === 'Received') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } };
            cell.font = { color: { argb: '166534' }, bold: true };
          } else if (st === 'WIP') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF9C3' } };
            cell.font = { color: { argb: '854D0E' }, bold: true };
          } else if (st === 'Due') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E6' } };
            cell.font = { color: { argb: '991B1B' }, bold: true };
          }
        });

        const balCell = addedRow.getCell(30);
        balCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0FDF4' } };
        balCell.font = { color: { argb: '166534' }, bold: true };
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Project_Milestone_Payment_Tracker.xlsx"');
      await workbook.xlsx.write(res);
      return res.end();
    }

    if (format === 'csv') {
      const csvHeaders = [
        'Sr. No.', 'Project Name', 'Client Name', 'Architect / Designer', 'Project Status',
        'Milestone 1 %', 'Milestone 1 Amount (₹)', 'Milestone 1 Date Received', 'Milestone 1 Status',
        'Milestone 2 %', 'Milestone 2 Amount (₹)', 'Milestone 2 Date Received', 'Milestone 2 Status',
        'Milestone 3 %', 'Milestone 3 Amount (₹)', 'Milestone 3 Date Received', 'Milestone 3 Status',
        'Milestone 4 %', 'Milestone 4 Amount (₹)', 'Milestone 4 Date Received', 'Milestone 4 Status',
        'Milestone 5 %', 'Milestone 5 Amount (₹)', 'Milestone 5 Date Received', 'Milestone 5 Status',
        '% Check', 'Total Project Value (₹)', 'Total Received (₹)', 'WIP (₹)', 'Balance Due (₹)', 'Notes'
      ];

      const csvLines = [csvHeaders.join(',')];
      rollups.forEach(r => {
        const line = [
          r.srNo,
          `"${r.projectName.replace(/"/g, '""')}"`,
          `"${r.clientName.replace(/"/g, '""')}"`,
          `"${r.architectDesigner.replace(/"/g, '""')}"`,
          `"${r.projectStatus}"`,
          r.milestones[0]?.percentFormatted || '',
          r.milestones[0]?.amount != null ? r.milestones[0].amount : '',
          formatDDMMMYY(r.milestones[0]?.dateReceived),
          r.milestones[0]?.status || 'Due',
          r.milestones[1]?.percentFormatted || '',
          r.milestones[1]?.amount != null ? r.milestones[1].amount : '',
          formatDDMMMYY(r.milestones[1]?.dateReceived),
          r.milestones[1]?.status || 'Due',
          r.milestones[2]?.percentFormatted || '',
          r.milestones[2]?.amount != null ? r.milestones[2].amount : '',
          formatDDMMMYY(r.milestones[2]?.dateReceived),
          r.milestones[2]?.status || 'Due',
          r.milestones[3]?.percentFormatted || '',
          r.milestones[3]?.amount != null ? r.milestones[3].amount : '',
          formatDDMMMYY(r.milestones[3]?.dateReceived),
          r.milestones[3]?.status || 'Due',
          r.milestones[4]?.percentFormatted || '',
          r.milestones[4]?.amount != null ? r.milestones[4].amount : '',
          formatDDMMMYY(r.milestones[4]?.dateReceived),
          r.milestones[4]?.status || 'Due',
          r.percentCheckFormatted,
          r.totalProjectValue != null ? r.totalProjectValue : '',
          r.totalReceived,
          r.wip,
          r.balanceDue,
          `"${r.notes.replace(/"/g, '""')}"`
        ];
        csvLines.push(line.join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="Project_Milestone_Payment_Tracker.csv"');
      return res.send(csvLines.join('\n'));
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ layout: 'landscape', margin: 20, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Project_Milestone_Payment_Tracker.pdf"');
      doc.pipe(res);

      doc.fontSize(16).fillColor('#B68D40').text('DOORBIN VISUALS — Milestone Payment Tracker', { align: 'center' });
      doc.fontSize(9).fillColor('#64748B').text(`Generated on ${new Date().toLocaleDateString('en-GB')} | Executive Financial Summary`, { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(8).fillColor('#1E293B');
      const startY = doc.y;
      doc.rect(20, startY, 800, 20).fill('#475569');
      doc.fillColor('#FFFFFF').text('SR.', 25, startY + 5);
      doc.text('PROJECT NAME', 50, startY + 5);
      doc.text('CLIENT', 200, startY + 5);
      doc.text('TOTAL VALUE', 350, startY + 5);
      doc.text('RECEIVED', 450, startY + 5);
      doc.text('WIP', 550, startY + 5);
      doc.text('BALANCE DUE', 650, startY + 5);
      doc.text('STATUS', 750, startY + 5);

      let currentY = startY + 22;
      rollups.forEach(r => {
        if (currentY > 530) {
          doc.addPage({ layout: 'landscape', margin: 20 });
          currentY = 30;
        }
        doc.fillColor('#1F1F1F').text(String(r.srNo), 25, currentY);
        doc.text(r.projectName, 50, currentY, { width: 140 });
        doc.text(r.clientName, 200, currentY, { width: 140 });
        doc.text(r.totalProjectValue ? `₹${r.totalProjectValue.toLocaleString()}` : 'Not Set', 350, currentY);
        doc.text(`₹${r.totalReceived.toLocaleString()}`, 450, currentY);
        doc.text(`₹${r.wip.toLocaleString()}`, 550, currentY);
        doc.text(`₹${r.balanceDue.toLocaleString()}`, 650, currentY);
        doc.text(r.projectStatus, 750, currentY);

        currentY += 18;
        doc.moveTo(20, currentY - 2).lineTo(820, currentY - 2).strokeColor('#E2E8F0').stroke();
      });

      doc.end();
      return;
    }

    return res.status(400).json({ success: false, message: 'Invalid format specified. Allowed: excel, pdf, csv' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTrackers,
  getTrackerByProject,
  createTracker,
  updateTracker,
  updateSingleMilestone,
  deleteTracker,
  bulkUploadTrackers,
  exportTrackers
};
