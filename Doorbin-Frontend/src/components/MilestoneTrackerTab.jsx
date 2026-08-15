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
  Edit2,
  Plus,
  Loader2
} from 'lucide-react';

export const MilestoneTrackerTab = ({ setToast }) => {
  const [trackers, setTrackers] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  // View Mode: 'clean' (Spreadsheet Grid + Modal Edit) | 'edit' (Inline Input Grid)
  const [tableMode, setTableMode] = useState('clean');

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

  // Single cell inline update handler
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
      if (setToast) setToast({ message: `Generating ${format.toUpperCase()} export...`, type: 'info' });
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

  // DARKER HEADER BORDER STYLING (As specifically requested for container & header cells)
  const mainThStyle = {
    backgroundColor: '#F4EFEA',
    color: '#1F1F1F',
    fontWeight: '700',
    fontSize: '0.75rem',
    letterSpacing: '0.04em',
    padding: '0.7rem 0.5rem',
    border: '1px solid #b8ae9c', // Darker, crisp header border
    textAlign: 'center',
    verticalAlign: 'middle'
  };

  const groupThStyle = {
    backgroundColor: '#EBE4D8',
    color: '#1F1F1F',
    fontWeight: '700',
    fontSize: '0.75rem',
    letterSpacing: '0.04em',
    padding: '0.7rem 0.5rem',
    border: '1px solid #b8ae9c', // Darker, crisp header border
    textAlign: 'center',
    verticalAlign: 'middle'
  };

  const subThStyle = {
    backgroundColor: '#F4EFEA',
    color: '#3D352E',
    fontWeight: '700',
    fontSize: '0.71rem',
    padding: '0.45rem 0.35rem',
    border: '1px solid #b8ae9c', // Darker, crisp subheader border
    textAlign: 'center',
    verticalAlign: 'middle'
  };

  // Standard Excel Cell Grid Style for Data Rows Below
  const tdStyle = {
    border: '1px solid #dcd3c8',
    padding: '0.5rem 0.5rem',
    verticalAlign: 'middle',
    fontSize: '0.78rem'
  };

  return (
    <div className="smooth-fade-in" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
      {/* TOOLBAR */}
      <div style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.85rem',
        marginBottom: '1rem',
        padding: '0.85rem 1.15rem',
        backgroundColor: '#ffffff',
        border: '1px solid #b8ae9c', // Darker toolbar border
        borderRadius: '8px'
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#78726a' }} />
            <input
              type="text"
              placeholder="Search project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                border: '1px solid #dcd3c8',
                borderRadius: '6px',
                fontSize: '0.815rem',
                color: '#1F1F1F',
                width: '200px'
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '0.45rem 0.75rem',
              border: '1px solid #dcd3c8',
              borderRadius: '6px',
              fontSize: '0.815rem',
              color: '#1F1F1F',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="Not Started">Not Started</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
          </select>

          <button type="submit" className="btn btn-secondary" style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}>
            Filter
          </button>
        </form>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* MODE TOGGLE */}
          <div style={{ display: 'flex', backgroundColor: '#f4efe8', padding: '0.2rem', borderRadius: '6px', border: '1px solid #dcd3c8' }}>
            <button
              onClick={() => setTableMode('clean')}
              style={{
                padding: '0.35rem 0.75rem',
                border: 'none',
                borderRadius: '5px',
                fontSize: '0.75rem',
                fontWeight: tableMode === 'clean' ? '700' : '500',
                backgroundColor: tableMode === 'clean' ? '#ffffff' : 'transparent',
                color: tableMode === 'clean' ? '#1F1F1F' : '#78726a',
                cursor: 'pointer'
              }}
            >
              📊 Spreadsheet View
            </button>
            <button
              onClick={() => setTableMode('edit')}
              style={{
                padding: '0.35rem 0.75rem',
                border: 'none',
                borderRadius: '5px',
                fontSize: '0.75rem',
                fontWeight: tableMode === 'edit' ? '700' : '500',
                backgroundColor: tableMode === 'edit' ? '#ffffff' : 'transparent',
                color: tableMode === 'edit' ? '#1F1F1F' : '#78726a',
                cursor: 'pointer'
              }}
            >
              ⚡ Quick Edit Mode
            </button>
          </div>

          <button
            onClick={() => handleOpenTrackerModal(null)}
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={14} /> Add Tracker
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Upload size={14} /> Upload Sheet
          </button>

          <button
            onClick={() => handleExport('excel')}
            disabled={exportingFormat === 'excel'}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <FileSpreadsheet size={14} /> {exportingFormat === 'excel' ? 'Exporting...' : 'Excel'}
          </button>

          <button
            onClick={() => handleExport('pdf')}
            disabled={exportingFormat === 'pdf'}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fecaca', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <FileText size={14} /> {exportingFormat === 'pdf' ? 'Exporting...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* EXCEL GRID SPREADSHEET TABLE WITH DARKER CONTAINER & HEADER BORDERS */}
      <div className="table-responsive" style={{ border: '1px solid #b8ae9c', borderRadius: '8px', overflowX: 'auto', backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <table className="table" style={{ fontSize: '0.78rem', borderCollapse: 'collapse', width: '100%', minWidth: '1650px' }}>
          <thead>
            {/* ROW 1: MAIN HEADERS */}
            <tr>
              <th rowSpan={2} style={{ ...mainThStyle, width: '45px' }}>SR. NO.</th>
              <th rowSpan={2} style={{ ...mainThStyle, width: '180px', textAlign: 'left' }}>PROJECT NAME</th>
              <th rowSpan={2} style={{ ...mainThStyle, width: '140px', textAlign: 'left' }}>CLIENT NAME</th>
              <th rowSpan={2} style={{ ...mainThStyle, width: '130px', textAlign: 'left' }}>ARCHITECT / DESIGNER</th>
              <th rowSpan={2} style={{ ...mainThStyle, width: '105px' }}>PROJECT STATUS</th>
              
              <th colSpan={4} style={groupThStyle}>MILESTONE 1</th>
              <th colSpan={4} style={groupThStyle}>MILESTONE 2</th>
              <th colSpan={4} style={groupThStyle}>MILESTONE 3</th>
              <th colSpan={4} style={groupThStyle}>MILESTONE 4</th>
              <th colSpan={4} style={groupThStyle}>MILESTONE 5</th>

              <th rowSpan={2} style={{ ...mainThStyle, width: '65px' }}>% CHECK</th>
              <th rowSpan={2} style={{ ...mainThStyle, width: '135px' }}>TOTAL PROJECT VALUE (₹)</th>
              <th rowSpan={2} style={{ ...mainThStyle, width: '115px' }}>TOTAL RECEIVED (₹)</th>
              <th rowSpan={2} style={{ ...mainThStyle, width: '105px' }}>WIP (₹)</th>
              <th rowSpan={2} style={{ ...mainThStyle, width: '120px', backgroundColor: '#e2efda', color: '#15803d', border: '1px solid #b8ae9c' }}>BALANCE DUE (₹)</th>
              <th rowSpan={2} style={{ ...mainThStyle, width: '120px', textAlign: 'left' }}>NOTES</th>
              <th rowSpan={2} style={{ ...mainThStyle, width: '65px' }}>ACTIONS</th>
            </tr>
            {/* ROW 2: SUB HEADERS */}
            <tr>
              {[1, 2, 3, 4, 5].map(mNum => (
                <React.Fragment key={mNum}>
                  <th style={{ ...subThStyle, width: '40px' }}>%</th>
                  <th style={{ ...subThStyle, width: '90px' }}>AMOUNT (₹)</th>
                  <th style={{ ...subThStyle, width: '95px' }}>DATE RECEIVED</th>
                  <th style={{ ...subThStyle, width: '80px' }}>STATUS</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {trackers.length === 0 ? (
              <tr>
                <td colSpan={32} style={{ ...tdStyle, textAlign: 'center', padding: '3.5rem 1.5rem', color: '#78726a', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <FileSpreadsheet size={32} color="#b68d40" />
                    <span style={{ fontWeight: '500' }}>No milestone payment trackers found. Click <strong>"Add Tracker"</strong> or upload an Excel file to get started.</span>
                  </div>
                </td>
              </tr>
            ) : (
              trackers.map((row, idx) => {
                const projId = row.project?._id || row.project;
                const projBudget = row.totalProjectValue;
                const isEven = idx % 2 === 0;

                return (
                  <tr key={projId} style={{ backgroundColor: isEven ? '#ffffff' : '#faf8f5' }}>
                    {/* Sr. No. */}
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: '700', color: '#1F1F1F' }}>
                      {row.srNo}
                    </td>
                    
                    {/* Project Name (Dark Navy Blue Link) */}
                    <td style={{ ...tdStyle, fontWeight: '700', color: '#1e40af' }}>
                      {row.project?.projectName || 'Project'}
                    </td>
                    
                    {/* Client Name (Dark Navy Blue Link) */}
                    <td style={{ ...tdStyle, color: '#1e40af', fontWeight: '600' }}>
                      {row.clientName}
                    </td>
                    
                    {/* Architect / Designer (Purple Text) */}
                    <td style={{ ...tdStyle, color: '#6b21a8' }}>
                      {tableMode === 'edit' ? (
                        <input
                          type="text"
                          defaultValue={row.architectDesigner || ''}
                          onBlur={(e) => handleMetaDataChange(projId, 'architectDesigner', e.target.value)}
                          placeholder="e.g. R. Shah"
                          style={{ width: '100%', padding: '0.2rem 0.35rem', border: '1px solid #dcd3c8', borderRadius: '4px', fontSize: '0.75rem', color: '#6b21a8' }}
                        />
                      ) : (
                        <span style={{ fontWeight: '600' }}>{row.architectDesigner || '-'}</span>
                      )}
                    </td>

                    {/* Project Status Badge */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span className={`badge ${row.project?.status === 'Completed' ? 'badge-success' : (row.project?.status === 'In Progress' ? 'badge-primary' : 'badge-secondary')}`} style={{ fontSize: '0.7rem' }}>
                        {row.project?.status || 'In Progress'}
                      </span>
                    </td>

                    {/* Milestones 1 to 5 */}
                    {[1, 2, 3, 4, 5].map(mNum => {
                      const m = row.milestones?.find(item => item.milestoneNumber === mNum) || { amount: null, dateReceived: null, status: 'Due', percentFormatted: '' };
                      const dateValStr = m.dateReceived ? new Date(m.dateReceived).toISOString().split('T')[0] : '';
                      const formattedDateDisplay = m.dateReceived ? formatDate(m.dateReceived) : '-';

                      // Status Badge Fills matching Client Sheet
                      // Received = Soft Green fill #E2EFDA, font #15803d
                      // WIP = Soft Khaki fill #FFF2CC, font #806000
                      // Due = Soft Pink fill #FCE4D6, font #C65911
                      const statusBg = m.status === 'Received' ? '#e2efda' : (m.status === 'WIP' ? '#fff2cc' : '#fce4d6');
                      const statusColor = m.status === 'Received' ? '#15803d' : (m.status === 'WIP' ? '#806000' : '#c65911');

                      return (
                        <React.Fragment key={mNum}>
                          {/* % Column */}
                          <td style={{ ...tdStyle, textAlign: 'center', color: '#1F1F1F', fontWeight: '700', backgroundColor: '#faf8f5' }}>
                            {m.percentFormatted || '-'}
                          </td>

                          {/* Amount Column (Dark Navy Blue Text) */}
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            {tableMode === 'edit' ? (
                              <input
                                type="number"
                                defaultValue={m.amount != null ? m.amount : ''}
                                onBlur={(e) => handleMilestoneCellChange(projId, mNum, 'amount', e.target.value)}
                                placeholder="₹"
                                style={{ width: '100%', padding: '0.2rem 0.3rem', border: '1px solid #dcd3c8', borderRadius: '4px', fontSize: '0.75rem', textAlign: 'right', fontWeight: '700', color: '#1e40af' }}
                              />
                            ) : (
                              <span style={{ fontWeight: '700', color: m.amount != null ? '#1e40af' : '#94a3b8' }}>
                                {m.amount != null ? `₹${Number(m.amount).toLocaleString('en-IN')}` : '-'}
                              </span>
                            )}
                          </td>

                          {/* Date Received Column (Purple Text) */}
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {tableMode === 'edit' ? (
                              <input
                                type="date"
                                defaultValue={dateValStr}
                                onChange={(e) => handleMilestoneCellChange(projId, mNum, 'dateReceived', e.target.value)}
                                style={{ width: '100%', padding: '0.15rem 0.2rem', border: '1px solid #dcd3c8', borderRadius: '4px', fontSize: '0.72rem', color: '#6b21a8' }}
                              />
                            ) : (
                              <span style={{ color: m.dateReceived ? '#6b21a8' : '#94a3b8', fontWeight: '600', fontSize: '0.75rem' }}>
                                {formattedDateDisplay}
                              </span>
                            )}
                          </td>

                          {/* Status Column (Solid Soft Badge Fill) */}
                          <td style={{ ...tdStyle, textAlign: 'center', padding: '0.3rem' }}>
                            {tableMode === 'edit' ? (
                              <select
                                value={m.status || 'Due'}
                                onChange={(e) => handleMilestoneCellChange(projId, mNum, 'status', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.2rem 0.2rem',
                                  border: '1px solid #dcd3c8',
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
                            ) : (
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '100%',
                                  padding: '0.25rem 0.4rem',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: '800',
                                  backgroundColor: statusBg,
                                  color: statusColor,
                                  textAlign: 'center'
                                }}
                              >
                                {m.status || 'Due'}
                              </span>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {/* % Check Column */}
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: '800', color: row.percentCheckValid ? '#15803d' : '#dc2626', backgroundColor: '#faf8f5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                        <span>{row.percentCheckFormatted}</span>
                        {!row.percentCheckValid && (
                          <span title={`Milestones total ${row.percentCheckFormatted} - check amounts`} style={{ color: '#dc2626', cursor: 'help' }}>
                            <AlertCircle size={13} />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total Project Value (Dark Navy Blue Text) */}
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800', color: '#1e40af', backgroundColor: '#ffffff' }}>
                      {projBudget != null ? (
                        <span>₹{Number(projBudget).toLocaleString('en-IN')}</span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: '#dc2626', fontStyle: 'italic' }}>Not Set</span>
                      )}
                    </td>

                    {/* Total Received (Dark Charcoal Text) */}
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800', color: '#1F1F1F', backgroundColor: '#ffffff' }}>
                      ₹{Number(row.totalReceived || 0).toLocaleString('en-IN')}
                    </td>

                    {/* WIP (Dark Charcoal Text) */}
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800', color: '#1F1F1F', backgroundColor: '#ffffff' }}>
                      ₹{Number(row.wip || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Balance Due (Soft Green Fill #E2EFDA, Bold Red Text #C65911) */}
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '800', color: '#c65911', backgroundColor: '#e2efda' }}>
                      ₹{Number(row.balanceDue || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Notes (Blue Text) */}
                    <td style={{ ...tdStyle, color: '#1e40af' }}>
                      {tableMode === 'edit' ? (
                        <input
                          type="text"
                          defaultValue={row.notes || ''}
                          onBlur={(e) => handleMetaDataChange(projId, 'notes', e.target.value)}
                          placeholder="Notes..."
                          style={{ width: '100%', padding: '0.2rem 0.35rem', border: '1px solid #dcd3c8', borderRadius: '4px', fontSize: '0.75rem', color: '#1e40af' }}
                        />
                      ) : (
                        <span style={{ fontWeight: '500' }}>{row.notes || '-'}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
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
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#3D352E', marginBottom: '0.3rem' }}>
                  SELECT PROJECT
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #dcd3c8', borderRadius: '6px', fontSize: '0.85rem', color: '#1F1F1F' }}
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
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#3D352E', marginBottom: '0.3rem' }}>
                  ARCHITECT / DESIGNER
                </label>
                <input
                  type="text"
                  placeholder="e.g. R. Shah"
                  value={architectDesigner}
                  onChange={(e) => setArchitectDesigner(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #dcd3c8', borderRadius: '6px', fontSize: '0.85rem', color: '#1F1F1F' }}
                />
              </div>
            </div>

            {/* LIVE COMPUTED SUMMARY CARD INSIDE MODAL */}
            <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1.15rem', backgroundColor: '#faf8f5', borderRadius: '8px', border: '1px solid #dcd3c8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', fontSize: '0.825rem' }}>
              <div>
                <span style={{ color: '#78726a', fontWeight: '500' }}>Project Budget: </span>
                <strong style={{ color: '#1e40af' }}>₹{selectedProjBudget.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: '#78726a', fontWeight: '500' }}>Received: </span>
                <strong style={{ color: '#15803d' }}>₹{modalTotalReceived.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: '#78726a', fontWeight: '500' }}>WIP: </span>
                <strong style={{ color: '#806000' }}>₹{modalWip.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: '#78726a', fontWeight: '500' }}>Balance Due: </span>
                <strong style={{ color: '#c65911' }}>₹{modalBalanceDue.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span style={{ color: '#78726a', fontWeight: '500' }}>% Check: </span>
                <strong style={{ color: modalPctCheck === 100 ? '#15803d' : '#dc2626' }}>{modalPctCheck}%</strong>
              </div>
            </div>

            {/* 5 MILESTONES FORM CARDS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[1, 2, 3, 4, 5].map(mNum => {
                const mForm = milestonesForm.find(item => item.milestoneNumber === mNum) || { amount: '', dateReceived: '', status: 'Due' };
                const mPct = selectedProjBudget > 0 && mForm.amount ? Math.round((Number(mForm.amount) / selectedProjBudget) * 100) : 0;

                return (
                  <div key={mNum} style={{ padding: '0.75rem 0.95rem', backgroundColor: '#ffffff', border: '1px solid #dcd3c8', borderRadius: '6px', display: 'grid', gridTemplateColumns: '1.3fr 2fr 2fr 1.8fr', gap: '0.85rem', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.815rem', color: '#1F1F1F' }}>
                      Milestone {mNum} {mPct > 0 && <span style={{ fontSize: '0.73rem', color: '#15803d', fontWeight: 600 }}>({mPct}%)</span>}
                    </div>

                    <div>
                      <input
                        type="number"
                        placeholder="Amount (₹)"
                        value={mForm.amount}
                        onChange={(e) => handleMilestoneFormChange(mNum, 'amount', e.target.value)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #dcd3c8', borderRadius: '5px', fontSize: '0.815rem', fontWeight: 600, color: '#1e40af' }}
                      />
                    </div>

                    <div>
                      <input
                        type="date"
                        value={mForm.dateReceived}
                        onChange={(e) => handleMilestoneFormChange(mNum, 'dateReceived', e.target.value)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #dcd3c8', borderRadius: '5px', fontSize: '0.8rem', color: '#6b21a8' }}
                      />
                    </div>

                    <div>
                      <select
                        value={mForm.status}
                        onChange={(e) => handleMilestoneFormChange(mNum, 'status', e.target.value)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #dcd3c8', borderRadius: '5px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
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
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#3D352E', marginBottom: '0.3rem' }}>
                TRACKER NOTES
              </label>
              <input
                type="text"
                placeholder="e.g. Payment details or notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #dcd3c8', borderRadius: '6px', fontSize: '0.85rem' }}
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
            <div style={{ marginBottom: '1.25rem', padding: '1.15rem', backgroundColor: '#faf8f5', borderRadius: '8px', border: '1px dashed #dcd3c8' }}>
              <label style={{ display: 'block', fontSize: '0.835rem', fontWeight: '700', color: '#1F1F1F', marginBottom: '0.45rem' }}>
                Select Client's Excel (.xlsx) or CSV File
              </label>
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => setUploadFile(e.target.files[0] || null)}
                style={{ fontSize: '0.825rem', color: '#1F1F1F' }}
                required
              />
              <p style={{ fontSize: '0.75rem', color: '#78726a', marginTop: '0.45rem', marginBottom: 0 }}>
                File must follow the 5-milestone payment sheet structure. Rows are matched automatically to existing Projects by Project Name & Client Name.
              </p>
            </div>

            {uploadSummary && (
              <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #dcd3c8' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#1F1F1F' }}>Bulk Upload Summary Result</h4>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#15803d', fontWeight: 700 }}>Updated: {uploadSummary.successCount}</span>
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>Errors: {uploadSummary.errorCount}</span>
                  <span style={{ color: '#78726a' }}>Skipped: {uploadSummary.skippedCount}</span>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.75rem', border: '1px solid #f4efe8', borderRadius: '6px', padding: '0.5rem' }}>
                  {uploadSummary.results?.map((res, idx) => (
                    <div key={idx} style={{ padding: '0.35rem 0', borderBottom: '1px solid #f4efe8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
