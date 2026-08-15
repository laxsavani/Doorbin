import React, { useState, useEffect } from 'react';
import { milestoneTrackerService } from '../services/milestoneTrackerService';
import { projectService } from '../services/projectService';
import { FormField } from './FormField';
import { Modal } from './Modal';
import { Toast } from './Toast';
import { Loader } from './Loader';
import { Pagination } from './Pagination';
import { formatDate } from '../utils/dateUtils';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Upload,
  Search,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Edit2,
  Save,
  Plus,
  Loader2,
  RefreshCw
} from 'lucide-react';

export const MilestoneTrackerTab = ({ setToast }) => {
  const [trackers, setTrackers] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Bulk Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState(null);

  // Edit / Add Tracker Modal State
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [architectDesigner, setArchitectDesigner] = useState('');
  const [notes, setNotes] = useState('');
  const [milestonesForm, setMilestonesForm] = useState([
    { milestoneNumber: 1, amount: '', dateReceived: '', status: 'Due' },
    { milestoneNumber: 2, amount: '', dateReceived: '', status: 'Due' },
    { milestoneNumber: 3, amount: '', dateReceived: '', status: 'Due' },
    { milestoneNumber: 4, amount: '', dateReceived: '', status: 'Due' },
    { milestoneNumber: 5, amount: '', dateReceived: '', status: 'Due' }
  ]);
  const [savingTracker, setSavingTracker] = useState(false);

  // Export State
  const [exportingFormat, setExportingFormat] = useState(null);

  // Cell Edit Tracking
  const [savingCellId, setSavingCellId] = useState(null);

  useEffect(() => {
    loadTrackers();
    loadProjectsRoster();
  }, [page, statusFilter]);

  const loadProjectsRoster = async () => {
    try {
      const data = await projectService.getProjects({ limit: 200 });
      const pList = Array.isArray(data) ? data : (data?.data || []);
      setProjectsList(pList);
    } catch (err) {
      console.warn('Failed to load projects roster:', err.message);
    }
  };

  const loadTrackers = async () => {
    setLoading(true);
    try {
      const res = await milestoneTrackerService.getTrackers({
        page,
        limit: pageSize,
        search,
        projectStatus: statusFilter
      });
      if (res && res.success) {
        setTrackers(res.data || []);
        setTotalPages(res.totalPages || 1);
        setTotalCount(res.totalCount || 0);
      } else {
        setTrackers([]);
      }
    } catch (err) {
      console.warn('Notice loading milestone payment trackers:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadTrackers();
  };

  // Open Tracker Modal for New or Edit
  const handleOpenTrackerModal = (existingRow = null) => {
    if (existingRow) {
      const projId = existingRow.project?._id || existingRow.project;
      setSelectedProjectId(projId);
      setArchitectDesigner(existingRow.architectDesigner || '');
      setNotes(existingRow.notes || '');

      const mArray = [1, 2, 3, 4, 5].map(num => {
        const found = existingRow.milestones?.find(m => m.milestoneNumber === num);
        return {
          milestoneNumber: num,
          amount: found?.amount != null ? String(found.amount) : '',
          dateReceived: found?.dateReceived ? new Date(found.dateReceived).toISOString().split('T')[0] : '',
          status: found?.status || 'Due'
        };
      });
      setMilestonesForm(mArray);
    } else {
      setSelectedProjectId(projectsList[0]?._id || '');
      setArchitectDesigner('');
      setNotes('');
      setMilestonesForm([
        { milestoneNumber: 1, amount: '', dateReceived: '', status: 'Due' },
        { milestoneNumber: 2, amount: '', dateReceived: '', status: 'Due' },
        { milestoneNumber: 3, amount: '', dateReceived: '', status: 'Due' },
        { milestoneNumber: 4, amount: '', dateReceived: '', status: 'Due' },
        { milestoneNumber: 5, amount: '', dateReceived: '', status: 'Due' }
      ]);
    }
    setIsTrackerModalOpen(true);
  };

  // Handle Milestone Form Cell Update in Modal
  const handleMilestoneFormChange = (mNum, field, val) => {
    setMilestonesForm(prev => prev.map(m => {
      if (m.milestoneNumber === mNum) {
        const updated = { ...m, [field]: val };
        if (field === 'dateReceived' && val && !m.status) {
          updated.status = 'Received';
        }
        return updated;
      }
      return m;
    }));
  };

  // Submit Tracker Modal Form
  const handleSaveTrackerModal = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      if (setToast) setToast({ message: 'Please select a Project', type: 'error' });
      return;
    }

    setSavingTracker(true);
    try {
      const payload = {
        architectDesigner,
        notes,
        milestones: milestonesForm.map(m => ({
          milestoneNumber: m.milestoneNumber,
          amount: m.amount !== '' && m.amount != null ? Number(m.amount) : null,
          dateReceived: m.dateReceived || null,
          status: m.status || 'Due'
        }))
      };

      await milestoneTrackerService.updateTracker(selectedProjectId, payload);
      if (setToast) setToast({ message: 'Project milestone tracker saved successfully!', type: 'success' });
      setIsTrackerModalOpen(false);
      loadTrackers();
    } catch (err) {
      if (setToast) setToast({ message: err.message || 'Failed to save milestone tracker', type: 'error' });
    } finally {
      setSavingTracker(false);
    }
  };

  // Single cell inline update handler for table
  const handleMilestoneCellChange = async (projectId, mNum, field, value) => {
    const trackerIdx = trackers.findIndex(t => t.project?._id === projectId || t.project === projectId);
    if (trackerIdx < 0) return;

    const updatedTrackers = [...trackers];
    const targetRow = { ...updatedTrackers[trackerIdx] };
    const mIdx = targetRow.milestones.findIndex(m => m.milestoneNumber === mNum);
    
    if (mIdx >= 0) {
      const updatedM = { ...targetRow.milestones[mIdx] };
      if (field === 'amount') {
        updatedM.amount = value !== '' && value != null ? Number(value) : null;
      } else if (field === 'dateReceived') {
        updatedM.dateReceived = value || null;
        if (value && !updatedM.status) updatedM.status = 'Received';
      } else if (field === 'status') {
        updatedM.status = value;
      }
      targetRow.milestones[mIdx] = updatedM;
      updatedTrackers[trackerIdx] = targetRow;
      setTrackers(updatedTrackers);
    }

    setSavingCellId(`${projectId}-${mNum}-${field}`);
    try {
      const payload = {
        amount: targetRow.milestones[mIdx]?.amount,
        dateReceived: targetRow.milestones[mIdx]?.dateReceived,
        status: targetRow.milestones[mIdx]?.status
      };
      payload[field] = value;

      const res = await milestoneTrackerService.updateSingleMilestone(projectId, mNum, payload);
      if (res && res.success && res.data) {
        updatedTrackers[trackerIdx] = {
          ...targetRow,
          ...res.data
        };
        setTrackers(updatedTrackers);
      }
    } catch (err) {
      if (setToast) setToast({ message: err.message || 'Failed to save cell update', type: 'error' });
      loadTrackers();
    } finally {
      setSavingCellId(null);
    }
  };

  const handleMetaDataChange = async (projectId, field, value) => {
    const trackerIdx = trackers.findIndex(t => t.project?._id === projectId || t.project === projectId);
    if (trackerIdx < 0) return;

    const updatedTrackers = [...trackers];
    updatedTrackers[trackerIdx][field] = value;
    setTrackers(updatedTrackers);

    try {
      const payload = { [field]: value };
      await milestoneTrackerService.updateTracker(projectId, payload);
    } catch (err) {
      if (setToast) setToast({ message: err.message || 'Failed to save notes', type: 'error' });
    }
  };

  const handleBulkUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      if (setToast) setToast({ message: 'Please select an Excel (.xlsx) or CSV file to upload', type: 'error' });
      return;
    }

    setUploading(true);
    setUploadSummary(null);
    try {
      const res = await milestoneTrackerService.bulkUpload(uploadFile);
      setUploadSummary(res);
      if (setToast) setToast({ message: `Bulk upload processed! ${res.successCount} projects updated.`, type: 'success' });
      loadTrackers();
    } catch (err) {
      if (setToast) setToast({ message: err.message || 'Failed to process bulk upload file', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async (format) => {
    setExportingFormat(format);
    try {
      if (setToast) setToast({ message: `Generating ${format.toUpperCase()} export matching spreadsheet layout...`, type: 'info' });
      const response = await milestoneTrackerService.exportTrackers({
        format,
        projectStatus: statusFilter
      });

      if (!response) return;

      const mimeType = format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : (format === 'pdf' ? 'application/pdf' : 'text/csv');

      const blob = new Blob([response.data || response], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Project_Milestone_Payment_Tracker.${format === 'excel' ? 'xlsx' : format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      if (setToast) setToast({ message: `${format.toUpperCase()} tracker report downloaded!`, type: 'success' });
    } catch (err) {
      if (setToast) setToast({ message: `Failed to export ${format.toUpperCase()} report`, type: 'error' });
    } finally {
      setExportingFormat(null);
    }
  };

  // Calculate live form summary for Modal
  const selectedProjObj = projectsList.find(p => p._id === selectedProjectId);
  const selectedProjBudget = selectedProjObj?.budget || 0;
  const modalTotalAmount = milestonesForm.reduce((sum, m) => sum + (m.amount ? Number(m.amount) : 0), 0);
  const modalTotalReceived = milestonesForm.filter(m => m.status === 'Received').reduce((sum, m) => sum + (m.amount ? Number(m.amount) : 0), 0);
  const modalWip = milestonesForm.filter(m => m.status === 'WIP').reduce((sum, m) => sum + (m.amount ? Number(m.amount) : 0), 0);
  const modalBalanceDue = milestonesForm.filter(m => m.status === 'Due').reduce((sum, m) => sum + (m.amount ? Number(m.amount) : 0), 0);
  const modalPctCheck = selectedProjBudget > 0 ? Math.round((modalTotalAmount / selectedProjBudget) * 100) : 0;

  if (loading && trackers.length === 0) {
    return <Loader message="Loading Milestone Payment Tracker..." />;
  }

  return (
    <div className="smooth-fade-in">
      {/* TOOLBAR: SEARCH, FILTERS, ADD FORM, UPLOAD & EXPORTS */}
      <div style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1.25rem',
        padding: '1rem',
        backgroundColor: '#ffffff',
        border: '1px solid #e9e5dc',
        borderRadius: '10px'
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#8c8882' }} />
            <input
              type="text"
              placeholder="Search project name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '0.45rem 0.65rem 0.45rem 2.2rem',
                border: '1px solid #dcd7ce',
                borderRadius: '6px',
                fontSize: '0.825rem',
                color: '#1F1F1F',
                width: '210px'
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '0.45rem 0.65rem',
              border: '1px solid #dcd7ce',
              borderRadius: '6px',
              fontSize: '0.825rem',
              color: '#1F1F1F',
              backgroundColor: '#ffffff'
            }}
          >
            <option value="all">All Project Statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="Not Started">Not Started</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <button type="submit" className="btn btn-secondary" style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}>
            Filter
          </button>
        </form>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleOpenTrackerModal(null)}
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={14} /> Add / Configure Tracker
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Upload size={14} /> Bulk Upload Sheet
          </button>

          <button
            onClick={() => handleExport('excel')}
            disabled={exportingFormat === 'excel'}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <FileSpreadsheet size={14} /> {exportingFormat === 'excel' ? 'Exporting...' : 'Excel Export'}
          </button>

          <button
            onClick={() => handleExport('pdf')}
            disabled={exportingFormat === 'pdf'}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fecaca', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <FileText size={14} /> {exportingFormat === 'pdf' ? 'Exporting...' : 'PDF Report'}
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={exportingFormat === 'csv'}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={14} /> {exportingFormat === 'csv' ? 'Exporting...' : 'CSV Export'}
          </button>
        </div>
      </div>

      {/* SPREADSHEET TABLE VIEW */}
      <div className="table-responsive" style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflowX: 'auto', backgroundColor: '#ffffff' }}>
        <table className="table" style={{ fontSize: '0.78rem', borderCollapse: 'collapse', width: '100%', minWidth: '1650px' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', color: '#ffffff', textAlign: 'center', fontSize: '0.75rem', letterSpacing: '0.03em' }}>
              <th rowSpan={2} style={{ width: '45px', padding: '0.65rem 0.4rem', borderRight: '1px solid #334155' }}>SR. NO.</th>
              <th rowSpan={2} style={{ width: '170px', padding: '0.65rem 0.5rem', borderRight: '1px solid #334155', textAlign: 'left' }}>PROJECT NAME</th>
              <th rowSpan={2} style={{ width: '140px', padding: '0.65rem 0.5rem', borderRight: '1px solid #334155', textAlign: 'left' }}>CLIENT NAME</th>
              <th rowSpan={2} style={{ width: '130px', padding: '0.65rem 0.5rem', borderRight: '1px solid #334155', textAlign: 'left' }}>ARCHITECT / DESIGNER</th>
              <th rowSpan={2} style={{ width: '105px', padding: '0.65rem 0.4rem', borderRight: '1px solid #334155' }}>PROJECT STATUS</th>
              
              <th colSpan={4} style={{ padding: '0.45rem', borderRight: '1px solid #334155', backgroundColor: '#334155' }}>MILESTONE 1</th>
              <th colSpan={4} style={{ padding: '0.45rem', borderRight: '1px solid #334155', backgroundColor: '#334155' }}>MILESTONE 2</th>
              <th colSpan={4} style={{ padding: '0.45rem', borderRight: '1px solid #334155', backgroundColor: '#334155' }}>MILESTONE 3</th>
              <th colSpan={4} style={{ padding: '0.45rem', borderRight: '1px solid #334155', backgroundColor: '#334155' }}>MILESTONE 4</th>
              <th colSpan={4} style={{ padding: '0.45rem', borderRight: '1px solid #334155', backgroundColor: '#334155' }}>MILESTONE 5</th>

              <th rowSpan={2} style={{ width: '65px', padding: '0.65rem 0.3rem', borderRight: '1px solid #334155' }}>% CHECK</th>
              <th rowSpan={2} style={{ width: '135px', padding: '0.65rem 0.5rem', borderRight: '1px solid #334155' }}>TOTAL PROJECT VALUE (₹)</th>
              <th rowSpan={2} style={{ width: '115px', padding: '0.65rem 0.5rem', borderRight: '1px solid #334155' }}>TOTAL RECEIVED (₹)</th>
              <th rowSpan={2} style={{ width: '105px', padding: '0.65rem 0.5rem', borderRight: '1px solid #334155' }}>WIP (₹)</th>
              <th rowSpan={2} style={{ width: '115px', padding: '0.65rem 0.5rem', borderRight: '1px solid #334155', backgroundColor: '#15803d' }}>BALANCE DUE (₹)</th>
              <th rowSpan={2} style={{ width: '130px', padding: '0.65rem 0.5rem', textAlign: 'left', borderRight: '1px solid #334155' }}>NOTES</th>
              <th rowSpan={2} style={{ width: '65px', padding: '0.65rem 0.3rem' }}>ACTIONS</th>
            </tr>
            <tr style={{ backgroundColor: '#334155', color: '#f8fafc', textAlign: 'center', fontSize: '0.72rem' }}>
              {[1, 2, 3, 4, 5].map(mNum => (
                <React.Fragment key={mNum}>
                  <th style={{ padding: '0.4rem', width: '45px', borderRight: '1px solid #475569' }}>%</th>
                  <th style={{ padding: '0.4rem', width: '90px', borderRight: '1px solid #475569' }}>AMOUNT (₹)</th>
                  <th style={{ padding: '0.4rem', width: '95px', borderRight: '1px solid #475569' }}>DATE RECEIVED</th>
                  <th style={{ padding: '0.4rem', width: '80px', borderRight: '1px solid #475569' }}>STATUS</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {trackers.length === 0 ? (
              <tr>
                <td colSpan={32} style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <FileSpreadsheet size={32} color="#94a3b8" />
                    <span>No milestone payment trackers found. Click <strong>"Add / Configure Tracker"</strong> or bulk upload an Excel sheet to populate data.</span>
                  </div>
                </td>
              </tr>
            ) : (
              trackers.map((row) => {
                const projId = row.project?._id || row.project;
                const projBudget = row.totalProjectValue;

                return (
                  <tr key={projId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ textAlign: 'center', fontWeight: '600', color: '#64748b' }}>{row.srNo}</td>
                    <td style={{ fontWeight: '700', color: '#2563eb' }}>
                      {row.project?.projectName || 'Project'}
                    </td>
                    <td style={{ color: '#2563eb', fontWeight: '500' }}>{row.clientName}</td>
                    
                    {/* Architect / Designer */}
                    <td>
                      <input
                        type="text"
                        defaultValue={row.architectDesigner || ''}
                        onBlur={(e) => handleMetaDataChange(projId, 'architectDesigner', e.target.value)}
                        placeholder="e.g. R. Shah"
                        style={{ width: '100%', padding: '0.2rem 0.35rem', border: '1px solid transparent', borderRadius: '4px', fontSize: '0.75rem', backgroundColor: 'transparent', color: '#7e22ce' }}
                      />
                    </td>

                    {/* Project Status Badge */}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${row.project?.status === 'Completed' ? 'badge-success' : (row.project?.status === 'In Progress' ? 'badge-primary' : 'badge-secondary')}`} style={{ fontSize: '0.7rem' }}>
                        {row.project?.status || 'In Progress'}
                      </span>
                    </td>

                    {/* Milestones 1 to 5 */}
                    {[1, 2, 3, 4, 5].map(mNum => {
                      const m = row.milestones?.find(item => item.milestoneNumber === mNum) || { amount: null, dateReceived: null, status: 'Due', percentFormatted: '' };
                      const dateValStr = m.dateReceived ? new Date(m.dateReceived).toISOString().split('T')[0] : '';

                      // Status Badge Fills matching sheet screenshot
                      const statusBg = m.status === 'Received' ? '#e2efda' : (m.status === 'WIP' ? '#fff2cc' : '#fce4d6');
                      const statusColor = m.status === 'Received' ? '#375623' : (m.status === 'WIP' ? '#806000' : '#c65911');

                      return (
                        <React.Fragment key={mNum}>
                          {/* % Derived Column */}
                          <td style={{ textAlign: 'center', color: '#64748b', fontWeight: '600', backgroundColor: '#faf9f6' }}>
                            {m.percentFormatted || '-'}
                          </td>

                          {/* Amount (₹) Input */}
                          <td style={{ padding: '0.2rem' }}>
                            <input
                              type="number"
                              defaultValue={m.amount != null ? m.amount : ''}
                              onBlur={(e) => handleMilestoneCellChange(projId, mNum, 'amount', e.target.value)}
                              placeholder="₹"
                              style={{ width: '100%', padding: '0.2rem 0.3rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#2563eb' }}
                            />
                          </td>

                          {/* Date Received Input */}
                          <td style={{ padding: '0.2rem' }}>
                            <input
                              type="date"
                              defaultValue={dateValStr}
                              onChange={(e) => handleMilestoneCellChange(projId, mNum, 'dateReceived', e.target.value)}
                              style={{ width: '100%', padding: '0.15rem 0.2rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.72rem', color: '#7e22ce' }}
                            />
                          </td>

                          {/* Status Dropdown */}
                          <td style={{ padding: '0.2rem', textAlign: 'center' }}>
                            <select
                              value={m.status || 'Due'}
                              onChange={(e) => handleMilestoneCellChange(projId, mNum, 'status', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.2rem 0.2rem',
                                border: '1px solid transparent',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: '800',
                                backgroundColor: statusBg,
                                color: statusColor,
                                cursor: 'pointer'
                              }}
                            >
                              <option value="Due">Due</option>
                              <option value="WIP">WIP</option>
                              <option value="Received">Received</option>
                            </select>
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {/* % Check Column */}
                    <td style={{ textAlign: 'center', fontWeight: '700', color: row.percentCheckValid ? '#15803d' : '#dc2626', backgroundColor: '#faf9f6' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                        <span>{row.percentCheckFormatted}</span>
                        {!row.percentCheckValid && (
                          <span title={`Milestones total ${row.percentCheckFormatted} - check amounts`} style={{ color: '#dc2626', cursor: 'help' }}>
                            <AlertCircle size={12} />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total Project Value */}
                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#2563eb', backgroundColor: '#f8fafc' }}>
                      {projBudget != null ? (
                        <span>₹{Number(projBudget).toLocaleString('en-IN')}</span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: '#dc2626', fontStyle: 'italic' }}>Not Set</span>
                      )}
                    </td>

                    {/* Total Received (₹) */}
                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#1F1F1F', backgroundColor: '#ffffff' }}>
                      ₹{Number(row.totalReceived || 0).toLocaleString('en-IN')}
                    </td>

                    {/* WIP (₹) */}
                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#1F1F1F', backgroundColor: '#ffffff' }}>
                      ₹{Number(row.wip || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Balance Due (₹) - Highlighted Column matching Excel sheet */}
                    <td style={{ textAlign: 'right', fontWeight: '800', color: '#c65911', backgroundColor: '#e2efda' }}>
                      ₹{Number(row.balanceDue || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Notes */}
                    <td>
                      <input
                        type="text"
                        defaultValue={row.notes || ''}
                        onBlur={(e) => handleMetaDataChange(projId, 'notes', e.target.value)}
                        placeholder="Notes..."
                        style={{ width: '100%', padding: '0.2rem 0.35rem', border: '1px solid transparent', borderRadius: '4px', fontSize: '0.75rem', color: '#2563eb' }}
                      />
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                        onClick={() => handleOpenTrackerModal(row)}
                        title="Edit Full Tracker Form"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalItems={totalCount}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      {/* ADD / EDIT MILESTONE TRACKER FORM MODAL */}
      {isTrackerModalOpen && (
        <Modal
          isOpen={isTrackerModalOpen}
          title={selectedProjectId ? "Configure Project Payment Milestones" : "Add Project Milestone Tracker"}
          onClose={() => setIsTrackerModalOpen(false)}
        >
          <form onSubmit={handleSaveTrackerModal}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#8c8882', marginBottom: '0.25rem' }}>
                  SELECT PROJECT
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', border: '1px solid #dcd7ce', borderRadius: '6px', fontSize: '0.85rem' }}
                  required
                >
                  <option value="">-- Select Project --</option>
                  {projectsList.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.projectName} ({p.projectCode || 'PROJ'}) - Budget: ₹{Number(p.budget || 0).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#8c8882', marginBottom: '0.25rem' }}>
                  ARCHITECT / DESIGNER
                </label>
                <input
                  type="text"
                  placeholder="e.g. R. Shah"
                  value={architectDesigner}
                  onChange={(e) => setArchitectDesigner(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.65rem', border: '1px solid #dcd7ce', borderRadius: '6px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* LIVE COMPUTED SUMMARY CARD INSIDE MODAL */}
            <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', backgroundColor: '#faf9f6', borderRadius: '8px', border: '1px solid #eeeae3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: '#8c8882' }}>Project Budget: </span>
                <strong style={{ color: '#1F1F1F' }}>₹{selectedProjBudget.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: '#8c8882' }}>Received: </span>
                <strong style={{ color: '#166534' }}>₹{modalTotalReceived.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: '#8c8882' }}>WIP: </span>
                <strong style={{ color: '#854d0e' }}>₹{modalWip.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: '#8c8882' }}>Balance Due: </span>
                <strong style={{ color: '#c65911' }}>₹{modalBalanceDue.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: '#8c8882' }}>% Check: </span>
                <strong style={{ color: modalPctCheck === 100 ? '#15803d' : '#dc2626' }}>{modalPctCheck}%</strong>
              </div>
            </div>

            {/* 5 MILESTONES FORM CARDS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[1, 2, 3, 4, 5].map(mNum => {
                const mForm = milestonesForm.find(item => item.milestoneNumber === mNum) || { amount: '', dateReceived: '', status: 'Due' };
                const mPct = selectedProjBudget > 0 && mForm.amount ? Math.round((Number(mForm.amount) / selectedProjBudget) * 100) : 0;

                return (
                  <div key={mNum} style={{ padding: '0.65rem 0.85rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'grid', gridTemplateColumns: '1.2fr 2fr 2fr 1.8fr', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#475569' }}>
                      Milestone {mNum} {mPct > 0 && <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>({mPct}%)</span>}
                    </div>

                    <div>
                      <input
                        type="number"
                        placeholder="Amount (₹)"
                        value={mForm.amount}
                        onChange={(e) => handleMilestoneFormChange(mNum, 'amount', e.target.value)}
                        style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}
                      />
                    </div>

                    <div>
                      <input
                        type="date"
                        value={mForm.dateReceived}
                        onChange={(e) => handleMilestoneFormChange(mNum, 'dateReceived', e.target.value)}
                        style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.78rem' }}
                      />
                    </div>

                    <div>
                      <select
                        value={mForm.status}
                        onChange={(e) => handleMilestoneFormChange(mNum, 'status', e.target.value)}
                        style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}
                      >
                        <option value="Due">Due</option>
                        <option value="WIP">WIP</option>
                        <option value="Received">Received</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#8c8882', marginBottom: '0.25rem' }}>
                TRACKER NOTES
              </label>
              <input
                type="text"
                placeholder="e.g. Sample notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.65rem', border: '1px solid #dcd7ce', borderRadius: '6px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsTrackerModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingTracker}>
                {savingTracker ? <><Loader2 className="spin" size={14} /> Saving Tracker...</> : 'Save Milestone Tracker'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* BULK UPLOAD MODAL */}
      {isUploadModalOpen && (
        <Modal
          isOpen={isUploadModalOpen}
          title="Bulk Upload Project Milestone Payment Tracker"
          onClose={() => { setIsUploadModalOpen(false); setUploadSummary(null); setUploadFile(null); }}
        >
          <form onSubmit={handleBulkUploadSubmit}>
            <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '700', color: '#334155', marginBottom: '0.4rem' }}>
                Select Client's Excel (.xlsx) or CSV File
              </label>
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => setUploadFile(e.target.files[0] || null)}
                style={{ fontSize: '0.825rem', color: '#1e293b' }}
                required
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem', marginBottom: 0 }}>
                File must follow the 5-milestone payment sheet structure. Rows are matched automatically to existing Projects by Project Name & Client Name.
              </p>
            </div>

            {uploadSummary && (
              <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#1e293b' }}>Bulk Upload Summary Result</h4>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#166534', fontWeight: 700 }}>Updated: {uploadSummary.successCount}</span>
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>Errors: {uploadSummary.errorCount}</span>
                  <span style={{ color: '#64748b' }}>Skipped: {uploadSummary.skippedCount}</span>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.75rem', border: '1px solid #f1f5f9', borderRadius: '6px', padding: '0.5rem' }}>
                  {uploadSummary.results?.map((res, idx) => (
                    <div key={idx} style={{ padding: '0.35rem 0', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>Row {res.row}:</strong> {res.projectName || 'Empty Row'}
                        {res.mismatchWarning && (
                          <div style={{ color: '#b45309', fontSize: '0.7rem', marginTop: '0.1rem' }}>⚠️ {res.mismatchWarning}</div>
                        )}
                      </div>
                      <span className={`badge ${res.status === 'success' ? 'badge-success' : (res.status === 'skipped' ? 'badge-secondary' : 'badge-danger')}`}>
                        {res.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsUploadModalOpen(false)}>
                Close
              </button>
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading ? <><Loader2 className="spin" size={14} /> Processing Sheet...</> : 'Upload & Process Sheet'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
