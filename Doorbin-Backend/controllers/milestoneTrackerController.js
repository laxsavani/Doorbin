const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const ProjectMilestonePayment = require('../models/ProjectMilestonePayment');
const Project = require('../models/Project');
const Client = require('../models/Client');
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
      .sort({ createdAt: -1 });

    const projectIds = projects.map(p => p._id);
    const existingTrackers = await ProjectMilestonePayment.find({ project: { $in: projectIds } });
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

    const processedMilestones = milestones.map(m => {
      let st = m.status || 'Due';
      if (m.dateReceived && !m.status) st = 'Received';
      return {
        milestoneNumber: m.milestoneNumber,
        amount: m.amount != null ? Number(m.amount) : null,
        dateReceived: m.dateReceived ? new Date(m.dateReceived) : null,
        status: st
      };
    });

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

    const processedMilestones = Array.isArray(milestones) ? milestones.map(m => {
      let st = m.status || 'Due';
      if (m.dateReceived && !m.status) st = 'Received';
      return {
        milestoneNumber: Number(m.milestoneNumber),
        amount: m.amount != null && m.amount !== '' ? Number(m.amount) : null,
        dateReceived: m.dateReceived ? new Date(m.dateReceived) : null,
        status: st
      };
    }) : undefined;

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

    const newMilestoneData = {
      milestoneNumber: mNum,
      amount: amount !== undefined ? (amount != null && amount !== '' ? Number(amount) : null) : (existingIdx >= 0 ? trackerDoc.milestones[existingIdx].amount : null),
      dateReceived: dateReceived !== undefined ? (dateReceived ? new Date(dateReceived) : null) : (existingIdx >= 0 ? trackerDoc.milestones[existingIdx].dateReceived : null),
      status: newStatus || (existingIdx >= 0 ? trackerDoc.milestones[existingIdx].status : 'Due')
    };

    if (existingIdx >= 0) {
      trackerDoc.milestones[existingIdx] = newMilestoneData;
    } else {
      trackerDoc.milestones.push(newMilestoneData);
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

    // Load all projects with clients for matching
    const allProjects = await Project.find().populate('client', 'clientName companyName');

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return; // Skip merged header rows 1 & 2

      const rowValues = row.values;
      const projNameRaw = rowValues[2] ? String(rowValues[2]).trim() : '';
      const clientNameRaw = rowValues[3] ? String(rowValues[3]).trim() : '';

      if (!projNameRaw && !clientNameRaw) {
        skippedCount++;
        results.push({ row: rowNumber, projectName: '', status: 'skipped', message: 'Empty row, skipped' });
        return;
      }

      // Matching logic: Project Name (case-insensitive) & Client Name (if provided)
      const matchedProjects = allProjects.filter(p => {
        const nameMatch = p.projectName.toLowerCase() === projNameRaw.toLowerCase();
        if (!nameMatch) return false;

        if (clientNameRaw) {
          const c = p.client;
          const cName = typeof c === 'object' ? (c?.companyName || c?.clientName || '') : '';
          return cName.toLowerCase().includes(clientNameRaw.toLowerCase());
        }
        return true;
      });

      if (matchedProjects.length === 0) {
        errorCount++;
        results.push({
          row: rowNumber,
          projectName: projNameRaw,
          status: 'error',
          message: `No matching Project found with name "${projNameRaw}" — create the Project first in Project Management before uploading payment data.`
        });
        return;
      }

      const targetProject = matchedProjects[0];
      const archDesigner = rowValues[4] ? String(rowValues[4]).trim() : '';

      // Parse 5 Milestones from column indices
      // Milestone 1: % (col 6), Amount (col 7), Date (col 8), Status (col 9)
      // Milestone 2: % (col 10), Amount (col 11), Date (col 12), Status (col 13)
      // Milestone 3: % (col 14), Amount (col 15), Date (col 16), Status (col 17)
      // Milestone 4: % (col 18), Amount (col 19), Date (col 20), Status (col 21)
      // Milestone 5: % (col 22), Amount (col 23), Date (col 24), Status (col 25)
      const parsedMilestones = [];
      for (let mIdx = 0; mIdx < 5; mIdx++) {
        const baseCol = 6 + (mIdx * 4);
        const amountVal = rowValues[baseCol + 1];
        const dateVal = rowValues[baseCol + 2];
        const statusVal = rowValues[baseCol + 3];

        let numAmount = null;
        if (amountVal != null && amountVal !== '') {
          const cleanAmt = String(amountVal).replace(/[^0-9.]/g, '');
          numAmount = cleanAmt ? Number(cleanAmt) : null;
        }

        let dateRec = null;
        if (dateVal) {
          const parsedD = new Date(dateVal);
          if (!isNaN(parsedD.getTime())) dateRec = parsedD;
        }

        let st = statusVal ? String(statusVal).trim() : 'Due';
        if (!['Due', 'WIP', 'Received'].includes(st)) st = 'Due';
        if (dateRec && !statusVal) st = 'Received';

        parsedMilestones.push({
          milestoneNumber: mIdx + 1,
          amount: numAmount,
          dateReceived: dateRec,
          status: st
        });
      }

      // Check Total Project Value mismatch
      const uploadedValueVal = rowValues[27]; // Total Project Value (col 27)
      let mismatchWarning = null;
      if (uploadedValueVal != null && uploadedValueVal !== '') {
        const cleanVal = String(uploadedValueVal).replace(/[^0-9.]/g, '');
        const numVal = Number(cleanVal);
        if (numVal && targetProject.budget && Math.abs(numVal - targetProject.budget) > 1) {
          mismatchWarning = `Uploaded Total Value (₹${numVal.toLocaleString()}) differs from Project budget (₹${Number(targetProject.budget).toLocaleString()}) — Project budget was NOT changed.`;
        }
      }

      const notesVal = rowValues[31] ? String(rowValues[31]).trim() : '';

      results.push({
        row: rowNumber,
        projectName: targetProject.projectName,
        status: 'success',
        action: 'updated',
        mismatchWarning,
        projectId: targetProject._id,
        parsedMilestones,
        notesVal,
        archDesigner
      });
    });

    // Execute database updates for valid rows
    for (const r of results) {
      if (r.status === 'success' && r.projectId) {
        await ProjectMilestonePayment.findOneAndUpdate(
          { project: r.projectId },
          {
            project: r.projectId,
            architectDesigner: r.archDesigner,
            milestones: r.parsedMilestones,
            notes: r.notesVal,
            updatedBy: req.user._id
          },
          { upsert: true, new: true }
        );
        successCount++;
      }
    }

    return res.json({
      success: true,
      totalRows: worksheet.rowCount - 2,
      successCount,
      skippedCount,
      errorCount,
      results
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export Milestone Payment Trackers (Excel / PDF / CSV)
// @route   GET /api/finance/milestone-tracker/export
// @access  Private (financeAccess)
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

      // Row 1: Group Headers
      ws.getRow(1).values = [
        '', '', '', '', '',
        'Milestone 1', '', '', '',
        'Milestone 2', '', '', '',
        'Milestone 3', '', '', '',
        'Milestone 4', '', '', '',
        'Milestone 5', '', '', '',
        '', '', '', '', '', ''
      ];

      // Merge Milestone Headers
      ws.mergeCells('F1:I1');
      ws.mergeCells('J1:M1');
      ws.mergeCells('N1:Q1');
      ws.mergeCells('R1:U1');
      ws.mergeCells('V1:Y1');

      // Row 2: Sub Headers
      ws.getRow(2).values = [
        'Sr. No.', 'Project Name', 'Client Name', 'Architect / Designer', 'Project Status',
        '%', 'Amount (₹)', 'Date Received', 'Status',
        '%', 'Amount (₹)', 'Date Received', 'Status',
        '%', 'Amount (₹)', 'Date Received', 'Status',
        '%', 'Amount (₹)', 'Date Received', 'Status',
        '%', 'Amount (₹)', 'Date Received', 'Status',
        '% Check', 'Total Project Value (₹)', 'Total Received (₹)', 'WIP (₹)', 'Balance Due (₹)', 'Notes'
      ];

      // Style Header Rows
      [1, 2].forEach(rNo => {
        const row = ws.getRow(rNo);
        row.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
        row.alignment = { vertical: 'middle', horizontal: 'center' };
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '475569' } };
        });
      });

      // Freeze headers
      ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 2 }];

      // Populate Data Rows
      rollups.forEach(r => {
        const rowData = [
          r.srNo,
          r.projectName,
          r.clientName,
          r.architectDesigner,
          r.projectStatus,
          // M1
          r.milestones[0]?.percent != null ? r.milestones[0].percent : '',
          r.milestones[0]?.amount != null ? r.milestones[0].amount : '',
          formatDDMMMYY(r.milestones[0]?.dateReceived),
          r.milestones[0]?.status || 'Due',
          // M2
          r.milestones[1]?.percent != null ? r.milestones[1].percent : '',
          r.milestones[1]?.amount != null ? r.milestones[1].amount : '',
          formatDDMMMYY(r.milestones[1]?.dateReceived),
          r.milestones[1]?.status || 'Due',
          // M3
          r.milestones[2]?.percent != null ? r.milestones[2].percent : '',
          r.milestones[2]?.amount != null ? r.milestones[2].amount : '',
          formatDDMMMYY(r.milestones[2]?.dateReceived),
          r.milestones[2]?.status || 'Due',
          // M4
          r.milestones[3]?.percent != null ? r.milestones[3].percent : '',
          r.milestones[3]?.amount != null ? r.milestones[3].amount : '',
          formatDDMMMYY(r.milestones[3]?.dateReceived),
          r.milestones[3]?.status || 'Due',
          // M5
          r.milestones[4]?.percent != null ? r.milestones[4].percent : '',
          r.milestones[4]?.amount != null ? r.milestones[4].amount : '',
          formatDDMMMYY(r.milestones[4]?.dateReceived),
          r.milestones[4]?.status || 'Due',
          // Rollups
          r.percentCheck != null ? r.percentCheck : '',
          r.totalProjectValue != null ? r.totalProjectValue : '',
          r.totalReceived,
          r.wip,
          r.balanceDue,
          r.notes
        ];

        const addedRow = ws.addRow(rowData);

        // Format Cells
        // Percentage cols: 6, 10, 14, 18, 22, 26
        [6, 10, 14, 18, 22, 26].forEach(colIdx => {
          const cell = addedRow.getCell(colIdx);
          if (typeof cell.value === 'number') {
            cell.numFmt = '0%';
          }
        });

        // Currency cols: 7, 11, 15, 19, 23, 27, 28, 29, 30
        [7, 11, 15, 19, 23, 27, 28, 29, 30].forEach(colIdx => {
          const cell = addedRow.getCell(colIdx);
          if (typeof cell.value === 'number') {
            cell.numFmt = '"₹"#,##0';
          }
        });

        // Status Background Fills (Cols 9, 13, 17, 21, 25)
        [9, 13, 17, 21, 25].forEach(colIdx => {
          const cell = addedRow.getCell(colIdx);
          const st = String(cell.value);
          if (st === 'Received') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } }; // Light Green
            cell.font = { color: { argb: '166534' }, bold: true };
          } else if (st === 'WIP') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF9C3' } }; // Light Yellow/Tan
            cell.font = { color: { argb: '854D0E' }, bold: true };
          } else if (st === 'Due') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E6' } }; // Light Pink
            cell.font = { color: { argb: '991B1B' }, bold: true };
          }
        });

        // Highlight Balance Due Column (Col 30)
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

      // Render summary table for PDF readability
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

