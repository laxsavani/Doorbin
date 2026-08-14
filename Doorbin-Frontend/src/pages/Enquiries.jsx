import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { enquiryService } from '../services/enquiryService';
import { userService } from '../services/userService';
import { authService } from '../services/authService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { validators, focusFirstErrorField } from '../utils/validation';
import { Plus, Search, PhoneCall, TrendingUp, UserCheck, DollarSign, Calendar, MessageSquare, ArrowRight, ShieldCheck, Trash2, Briefcase, Tag, AlertTriangle, Award, Edit3, LayoutGrid, List, Loader2 } from 'lucide-react';
import { useViewMode } from '../hooks/useViewMode';
import './Dashboard.css';

const PROJECT_TYPES = ['Architecture', 'Interior Design', 'Animation'];
export const LEAD_TEMPERATURES = ['Hot', 'Warm', 'Cold'];
export const PRIORITIES = LEAD_TEMPERATURES;
const STAGES = ['New Enquiry', 'Qualification', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Project Creation'];

const getTempDetails = (val) => {
  const str = String(val || '').toLowerCase();
  if (str === 'hot' || str === 'high') {
    return { label: 'Hot', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', emoji: '🔥' };
  }
  if (str === 'cold' || str === 'low') {
    return { label: 'Cold', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', emoji: '❄️' };
  }
  return { label: 'Warm', color: '#d97706', bg: '#fffbe6', border: '#fef08a', emoji: '☀️' };
};

export const Enquiries = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = authService.getCurrentUser();
  const userRoleName = typeof currentUser?.role === 'object'
    ? (currentUser?.role?.name || 'Artist')
    : (currentUser?.role || 'Artist');
  const canManageBD = userRoleName.toLowerCase() === 'director' || userRoleName.toLowerCase() === 'business development manager';

  const [enquiries, setEnquiries] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [summaryReport, setSummaryReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [convertingId, setConvertingId] = useState(null);
  const [viewMode, setViewMode] = useViewMode();

  const [deletingEnquiryId, setDeletingEnquiryId] = useState(null);
  const [selectedBDEFilter, setSelectedBDEFilter] = useState('All');

  // Drag and Drop state for Kanban
  const [dragOverStage, setDragOverStage] = useState(null);
  const [draggingEnquiryId, setDraggingEnquiryId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState('All');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);

  // Form State
  const [newEnquiry, setNewEnquiry] = useState({
    clientName: '',
    architectName: '',
    projectName: '',
    projectType: 'Architecture',
    estimatedValue: '',
    source: '',
    assignedExecutive: '',
    followUpDate: '',
    leadTemperature: 'Warm',
    notes: '',
    status: 'New Enquiry'
  });

  // Activity Log State
  const [newActivity, setNewActivity] = useState({
    type: 'Call',
    description: '',
    followUpDate: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchEnquiriesAndExecutives();
  }, [location.key]);

  const fetchEnquiriesAndExecutives = async () => {
    setLoading(true);
    try {
      const data = await enquiryService.getEnquiries();
      const usersData = await userService.getUsers();
      const report = await enquiryService.getPipelineSummaryReport();

      let extractedEnquiries = Array.isArray(data) ? data : (data?.enquiries || data?.data || []);
      let extractedUsers = Array.isArray(usersData) ? usersData : (usersData?.users || usersData?.data || []);

      let bdExecutives = extractedUsers.filter(u => {
        const r = (typeof u.role === 'object' ? u.role?.name : u.role || '').toLowerCase();
        return r.includes('business') || r.includes('bd') || r.includes('sales') || r.includes('executive') || r.includes('director');
      });
      if (bdExecutives.length === 0) bdExecutives = extractedUsers;

      setEnquiries(extractedEnquiries);
      setExecutives(bdExecutives);
      setSummaryReport(report);

      if (bdExecutives.length > 0) {
        setNewEnquiry(prev => ({ ...prev, assignedExecutive: bdExecutives[0]._id }));
      }
    } catch (err) {
      setToast({ message: err.message || 'Failed to load BD enquiry pipeline data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEnquiry = async (e) => {
    e.preventDefault();

    const errors = {};
    const clientErr = validators.required(newEnquiry.clientName, 'Client Name');
    if (clientErr) errors.clientName = clientErr;

    const projErr = validators.required(newEnquiry.projectName, 'Project Name');
    if (projErr) errors.projectName = projErr;

    const execErr = validators.required(newEnquiry.assignedExecutive, 'Assigned Executive');
    if (execErr) errors.assignedExecutive = execErr;

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstErrorField(errors);
      return;
    }

    setSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = await enquiryService.createEnquiry({
        ...newEnquiry,
        estimatedValue: Number(newEnquiry.estimatedValue || 0)
      });

      const matchedExec = executives.find(u => u._id === newEnquiry.assignedExecutive);
      const createdItem = response.enquiry || response || {
        _id: `enq_${Date.now()}`,
        ...newEnquiry,
        assignedExecutive: matchedExec || { name: 'Assigned Executive' },
        activityLog: [],
        createdAt: new Date().toISOString()
      };

      setEnquiries([createdItem, ...enquiries]);
      setToast({ message: 'Enquiry record added to Business Development pipeline!', type: 'success' });
      setNewEnquiry({
        clientName: '',
        architectName: '',
        projectName: '',
        projectType: 'Architecture',
        estimatedValue: '',
        source: '',
        assignedExecutive: executives[0]?._id || '',
        followUpDate: '',
        leadTemperature: 'Warm',
        notes: '',
        status: 'New Enquiry'
      });
      setIsCreateModalOpen(false);
    } catch (err) {
      setToast({ message: err.message || 'Failed to create enquiry', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateEnquiryForm = () => {
    setNewEnquiry({
      clientName: '',
      architectName: '',
      projectName: '',
      projectType: '3D Renders & Walkthrough',
      estimatedValue: '',
      assignedExecutive: executives[0]?._id || '',
      leadTemperature: 'Warm',
      source: '',
      notes: ''
    });
    setFormErrors({});
    setIsCreateModalOpen(false);
  };

  const resetEditEnquiryForm = () => {
    setEditingEnquiry(null);
    setFormErrors({});
    setIsEditModalOpen(false);
  };

  const handleConvertEnquiry = async (enq) => {
    setConvertingId(enq._id);
    try {
      setToast({ message: `Opening Client Register for "${enq.projectName}"...`, type: 'info' });
      await new Promise(resolve => setTimeout(resolve, 1200));

      navigate('/clients', {
        state: {
          autoOpenCreate: true,
          enquiryData: enq,
          sourceEnquiryId: enq._id
        }
      });
    } finally {
      setConvertingId(null);
    }
  };

  const handleOpenEditModal = (enq) => {
    setEditingEnquiry(enq);
    setNewEnquiry({
      clientName: enq.clientName || '',
      architectName: enq.architectName || '',
      projectName: enq.projectName || '',
      projectType: enq.projectType || 'Architecture',
      estimatedValue: enq.estimatedValue || '',
      source: enq.source || '',
      assignedExecutive: typeof enq.assignedExecutive === 'object' ? (enq.assignedExecutive?._id || '') : (enq.assignedExecutive || ''),
      followUpDate: enq.followUpDate ? enq.followUpDate.split('T')[0] : '',
      leadTemperature: enq.leadTemperature || enq.priority || 'Warm',
      notes: enq.notes || '',
      status: enq.status || 'New Enquiry'
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleUpdateEnquiry = async (e) => {
    e.preventDefault();
    if (!editingEnquiry) return;

    const errors = {};
    const clientErr = validators.required(newEnquiry.clientName, 'Client Name');
    if (clientErr) errors.clientName = clientErr;

    const projErr = validators.required(newEnquiry.projectName, 'Project Name');
    if (projErr) errors.projectName = projErr;

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstErrorField(errors);
      return;
    }

    setSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const updatePayload = {
        ...newEnquiry,
        estimatedValue: Number(newEnquiry.estimatedValue || 0)
      };

      const response = await enquiryService.updateEnquiry(editingEnquiry._id, updatePayload);
      const updatedItem = response.enquiry || response;

      const matchedExec = executives.find(u => u._id === newEnquiry.assignedExecutive);

      setEnquiries(enquiries.map(e => e._id === editingEnquiry._id ? {
        ...e,
        ...updatedItem,
        ...newEnquiry,
        assignedExecutive: matchedExec || e.assignedExecutive
      } : e));

      if (selectedEnquiry && selectedEnquiry._id === editingEnquiry._id) {
        setSelectedEnquiry(prev => ({
          ...prev,
          ...newEnquiry,
          assignedExecutive: matchedExec || prev.assignedExecutive
        }));
      }

      setToast({ message: 'Enquiry record updated successfully!', type: 'success' });
      setIsEditModalOpen(false);
      setEditingEnquiry(null);
    } catch (err) {
      setToast({ message: err.message || 'Failed to update enquiry record', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (enquiryId, newStatus) => {
    try {
      await enquiryService.updateEnquiryStatus(enquiryId, newStatus);
      setToast({ message: `Enquiry status moved to ${newStatus}`, type: 'success' });
      setEnquiries(enquiries.map(e => e._id === enquiryId ? { ...e, status: newStatus } : e));
      if (selectedEnquiry && selectedEnquiry._id === enquiryId) {
        setSelectedEnquiry({ ...selectedEnquiry, status: newStatus });
      }
    } catch (err) {
      setToast({ message: err.message || 'Failed to update stage status', type: 'error' });
    }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    if (!selectedEnquiry || !newActivity.description) return;

    try {
      await enquiryService.addActivityLog(selectedEnquiry._id, newActivity);
      const activityEntry = {
        _id: `act_${Date.now()}`,
        type: newActivity.type,
        description: newActivity.description,
        date: new Date().toISOString(),
        createdBy: { name: 'BD Executive' }
      };

      const updatedEnquiry = {
        ...selectedEnquiry,
        followUpDate: newActivity.followUpDate || selectedEnquiry.followUpDate,
        activityLog: [activityEntry, ...(selectedEnquiry.activityLog || [])]
      };

      setSelectedEnquiry(updatedEnquiry);
      setEnquiries(enquiries.map(e => e._id === selectedEnquiry._id ? updatedEnquiry : e));

      const scheduledMsg = newActivity.followUpDate
        ? `Activity logged & Follow-Up date (${newActivity.followUpDate}) added to Master Calendar!`
        : 'Activity log entry recorded!';

      setToast({ message: scheduledMsg, type: 'success' });
      setNewActivity({ type: 'Call', description: '', followUpDate: '' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to log activity', type: 'error' });
    }
  };

  const confirmDeleteEnquiry = async () => {
    if (!deletingEnquiryId) return;
    try {
      await enquiryService.deleteEnquiry(deletingEnquiryId);
      setToast({ message: 'Enquiry deleted successfully', type: 'success' });
      setEnquiries(enquiries.filter(e => e._id !== deletingEnquiryId));
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete enquiry', type: 'error' });
    } finally {
      setDeletingEnquiryId(null);
    }
  };

  const filteredEnquiries = enquiries.filter(enq => {
    const execId = typeof enq.assignedExecutive === 'object' ? enq.assignedExecutive?._id : enq.assignedExecutive;
    const execName = typeof enq.assignedExecutive === 'object' ? enq.assignedExecutive?.name : enq.assignedExecutive;
    const matchesSearch = (
      enq.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enq.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enq.architectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      execName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesStage = selectedStageFilter === 'All' || enq.status === selectedStageFilter;
    const matchesBDE = selectedBDEFilter === 'All' || execId === selectedBDEFilter;
    return matchesSearch && matchesStage && matchesBDE;
  });

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      <div className="page-header-responsive">
        <div className="page-header-title-block">
          <h1 className="hero-serif-title">Business Development & CRM</h1>
          <p className="hero-sub-summary">Manage lead pipeline, project enquiries, stage conversions and executive activities</p>
        </div>

        <div className="page-header-actions">
          {/* Dual View Toggle */}
          <div className="view-toggle-container">
            <button
              className={`view-toggle-btn ${viewMode === 'stripe' ? 'active' : ''}`}
              onClick={() => setViewMode('stripe')}
            >
              <List size={14} /> Stripe View
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid size={14} /> Card View
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid size={14} /> Kanban View
            </button>
          </div>

          {canManageBD && (
            <button onClick={() => setIsCreateModalOpen(true)} className="btn-new-task">
              <Plus size={16} /> New Enquiry
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Loader text="Loading BD pipeline & enquiry roster..." />
      ) : (
        <>
          {/* Summary Pipeline Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="project-category-text">TOTAL ENQUIRIES</span>
                <Briefcase size={18} color="#B68D40" />
              </div>
              <div className="project-card-title" style={{ fontSize: '1.65rem', marginTop: '0.35rem' }}>
                {enquiries.length} Active Leads
              </div>
            </div>

            <div className="project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="project-category-text">PIPELINE VALUE</span>
                <DollarSign size={18} color="#2b7a3d" />
              </div>
              <div className="project-card-title" style={{ fontSize: '1.65rem', marginTop: '0.35rem' }}>
                ₹{(enquiries.reduce((acc, curr) => acc + (Number(curr.estimatedValue) || 0), 0) / 100000).toFixed(2)} Lakhs
              </div>
            </div>

            <div className="project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="project-category-text">WIN CONVERSION</span>
                <Award size={18} color="#7a42c9" />
              </div>
              <div className="project-card-title" style={{ fontSize: '1.65rem', marginTop: '0.35rem' }}>
                {enquiries.length > 0
                  ? Math.round((enquiries.filter(e => e.status === 'Won' || e.status === 'Project Creation').length / enquiries.length) * 100)
                  : 0}% Rate
              </div>
            </div>
          </div>

          {/* Search & Stage Filter Bar */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '260px', maxWidth: '380px' }}>
              <Search size={16} color="#8c8882" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search by client, project, architect or BD executive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="top-bar-search-input"
                style={{ width: '100%', paddingLeft: '2.25rem' }}
              />
            </div>

            {/* Desktop Stage Filter Pills */}
            <div className="desktop-tabs-container" style={{ alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8c8882' }}>STAGE:</span>
              <button
                onClick={() => setSelectedStageFilter('All')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  border: '1px solid #dcd8cf',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: selectedStageFilter === 'All' ? '#1F1F1F' : '#ffffff',
                  color: selectedStageFilter === 'All' ? '#ffffff' : '#78746d',
                  cursor: 'pointer'
                }}
              >
                All ({enquiries.length})
              </button>
              {STAGES.map((stg) => {
                const cnt = enquiries.filter(e => e.status === stg).length;
                return (
                  <button
                    key={stg}
                    onClick={() => setSelectedStageFilter(stg)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '9999px',
                      border: '1px solid #dcd8cf',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: selectedStageFilter === stg ? '#B68D40' : '#ffffff',
                      color: selectedStageFilter === stg ? '#ffffff' : '#78746d',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {stg} ({cnt})
                  </button>
                );
              })}
            </div>

            {/* Executive (BDE) Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8c8882' }}>BDE:</span>
              <select
                value={selectedBDEFilter}
                onChange={(e) => setSelectedBDEFilter(e.target.value)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '8px',
                  border: '1px solid #dcd8cf',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: '#ffffff'
                }}
              >
                <option value="All">All BDE Executives</option>
                {executives.map(e => (
                  <option key={e._id} value={e._id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* DUAL VIEW RENDER: STRIPE TABLE OR CARD GRID */}
          {viewMode === 'stripe' ? (
            <div className="team-widget-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#faf9f6', borderBottom: '1px solid #eeeae3', color: '#8c8882', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'left' }}>Project & Client</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>Type & Priority</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>Estimated Value</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>BD Executive</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>Stage Status</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnquiries.map((enq) => {
                    const execName = typeof enq.assignedExecutive === 'object'
                      ? (enq.assignedExecutive?.name || 'BD Executive')
                      : (executives.find(u => u._id === enq.assignedExecutive)?.name || 'BD Executive');

                    return (
                      <tr
                        key={enq._id}
                        onClick={() => { setSelectedEnquiry(enq); setIsDetailModalOpen(true); }}
                        style={{ borderBottom: '1px solid #f2ece4', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'left', wordBreak: 'break-word' }}>
                          <div style={{ fontWeight: 700, color: '#1a1918' }}>{enq.projectName}</div>
                          <div style={{ fontSize: '0.78rem', color: '#8c8882' }}>Client: {enq.clientName}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1.25rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                            <span className="task-status-blue" style={{ fontSize: '0.68rem' }}>{enq.projectType}</span>
                            {(() => {
                              const t = getTempDetails(enq.leadTemperature || enq.priority);
                              return (
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px', backgroundColor: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
                                  {t.emoji} {t.label}
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1.25rem', textAlign: 'center', fontWeight: 700, color: '#15803d' }}>
                          ₹{Number(enq.estimatedValue || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.75rem 1.25rem', textAlign: 'center', fontWeight: 600 }}>{execName}</td>
                        <td style={{ padding: '0.75rem 1.25rem', textAlign: 'center' }}>
                          <select
                            value={enq.status}
                            onChange={(e) => { e.stopPropagation(); handleStatusChange(enq._id, e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '8px',
                              border: '1px solid #d8d4cb',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: (enq.status === 'Won' || enq.status === 'Project Creation') ? '#f0fdf4' : (enq.status === 'Lost' ? '#fef2f2' : '#ffffff'),
                              color: (enq.status === 'Won' || enq.status === 'Project Creation') ? '#16a34a' : (enq.status === 'Lost' ? '#dc2626' : '#1F1F1F')
                            }}
                          >
                            {STAGES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '0.75rem 1.25rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                            {enq.status === 'Won' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleConvertEnquiry(enq); }}
                                className="btn btn-primary"
                                disabled={convertingId === enq._id}
                                style={{ padding: '0.25rem 0.65rem', fontSize: '0.725rem', backgroundColor: '#B68D40', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                title="Convert Won Enquiry into Active Client"
                              >
                                {convertingId === enq._id ? (
                                  <><Loader2 className="animate-spin" size={13} /> Converting...</>
                                ) : (
                                  <>🚀 Convert to Client</>
                                )}
                              </button>
                            )}
                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedEnquiry(enq); setIsDetailModalOpen(true); }} className="btn btn-secondary" style={{ padding: '0.25rem 0.55rem', fontSize: '0.725rem' }}>
                                Details
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleOpenEditModal(enq); }} className="btn btn-secondary" style={{ padding: '0.25rem 0.45rem' }}>
                                <Edit3 size={14} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : viewMode === 'card' ? (
            <div className="responsive-cards-grid">
              {filteredEnquiries.map((enq) => {
                const execName = typeof enq.assignedExecutive === 'object'
                  ? (enq.assignedExecutive?.name || 'BD Executive')
                  : (executives.find(u => u._id === enq.assignedExecutive)?.name || 'BD Executive');

                return (
                  <div
                    key={enq._id}
                    className="team-widget-card"
                    onClick={() => { setSelectedEnquiry(enq); setIsDetailModalOpen(true); }}
                    style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <span className="task-status-blue" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                          {enq.projectType}
                        </span>

                        {(() => {
                          const t = getTempDetails(enq.leadTemperature || enq.priority);
                          return (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.2rem 0.6rem',
                                borderRadius: '9999px',
                                backgroundColor: t.bg,
                                color: t.color,
                                border: `1px solid ${t.border}`
                              }}
                            >
                              {t.emoji} {t.label}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="task-title-bold" style={{ fontSize: '1.15rem', marginBottom: '0.2rem' }}>
                        {enq.projectName}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4a4742', marginBottom: '0.75rem' }}>
                        Client: {enq.clientName} {enq.architectName && `· Architect: ${enq.architectName}`}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid #f2ece4', paddingTop: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: '#8c8882', fontWeight: 500 }}>ESTIMATED VALUE:</span>
                          <span style={{ fontWeight: 700, color: '#15803d' }}>
                            ₹{Number(enq.estimatedValue || 0).toLocaleString()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: '#8c8882', fontWeight: 500 }}>BD EXECUTIVE:</span>
                          <span style={{ fontWeight: 600, color: '#1F1F1F' }}>{execName}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #f2ece4', paddingTop: '0.85rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* Stage Selector Dropdown */}
                        <select
                          value={enq.status}
                          onChange={(e) => handleStatusChange(enq._id, e.target.value)}
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '8px',
                            border: '1px solid #d8d4cb',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: '#ffffff',
                            flex: '1 1 auto',
                            minWidth: '130px'
                          }}
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>

                        {enq.status === 'Won' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleConvertEnquiry(enq); }}
                            className="btn btn-primary"
                            disabled={convertingId === enq._id}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', backgroundColor: '#B68D40', border: 'none', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                            title="Convert Won Enquiry into Active Client"
                          >
                            {convertingId === enq._id ? (
                              <><Loader2 className="animate-spin" size={13} /> Converting...</>
                            ) : (
                              <>🚀 Convert to Client</>
                            )}
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedEnquiry(enq); setIsDetailModalOpen(true); }}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <MessageSquare size={14} /> Activity ({enq.activityLog?.length || 0})
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenEditModal(enq); }}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', color: '#10529d', flexShrink: 0 }}
                          title="Edit Enquiry Record"
                        >
                          <Edit3 size={14} />
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingEnquiryId(enq._id); }}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', color: '#dc2626', borderColor: '#fecaca', flexShrink: 0 }}
                          title="Delete Enquiry Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* KANBAN PIPELINE VIEW WITH DRAG AND DROP & VISUAL FEEDBACK */
            <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
              {['New Enquiry', 'Qualification', 'Meeting', 'Proposal', 'Negotiation', 'Won'].map((stg) => {
                const stageEnquiries = filteredEnquiries.filter(e => e.status === stg);
                const isOver = dragOverStage === stg;

                return (
                  <div
                    key={stg}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverStage !== stg) setDragOverStage(stg);
                    }}
                    onDragLeave={() => setDragOverStage(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverStage(null);
                      const draggedId = e.dataTransfer.getData('enquiryId') || draggingEnquiryId;
                      if (draggedId) {
                        handleStatusChange(draggedId, stg);
                        setDraggingEnquiryId(null);
                      }
                    }}
                    style={{
                      minWidth: '275px',
                      width: '275px',
                      backgroundColor: isOver ? '#f3ebd9' : '#faf9f6',
                      borderRadius: '12px',
                      border: isOver ? '2px dashed #B68D40' : '1px solid #e8e4dc',
                      padding: '0.85rem',
                      flexShrink: 0,
                      transition: 'all 150ms ease',
                      boxShadow: isOver ? '0 4px 12px rgba(182,141,64,0.15)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid #B68D40' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1F1F1F' }}>{stg}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: isOver ? '#B68D40' : '#e2ded8', color: isOver ? '#ffffff' : '#4a4742', padding: '0.15rem 0.5rem', borderRadius: '9999px', transition: 'all 150ms ease' }}>
                        {stageEnquiries.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '130px' }}>
                      {stageEnquiries.map((enq) => {
                        const execName = typeof enq.assignedExecutive === 'object'
                          ? (enq.assignedExecutive?.name || 'BD Executive')
                          : (executives.find(u => u._id === enq.assignedExecutive)?.name || 'BD Executive');

                        const tempColor = enq.leadTemperature === 'Hot' ? '#dc2626' : (enq.leadTemperature === 'Cold' ? '#2563eb' : '#d97706');
                        const tempBg = enq.leadTemperature === 'Hot' ? '#fef2f2' : (enq.leadTemperature === 'Cold' ? '#eff6ff' : '#fffbe6');
                        const isDragging = draggingEnquiryId === enq._id;

                        return (
                          <div
                            key={enq._id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('enquiryId', enq._id);
                              setDraggingEnquiryId(enq._id);
                            }}
                            onDragEnd={() => {
                              setDraggingEnquiryId(null);
                              setDragOverStage(null);
                            }}
                            style={{
                              backgroundColor: '#ffffff',
                              borderRadius: '8px',
                              border: '1px solid #e2ded8',
                              padding: '0.75rem',
                              boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                              opacity: isDragging ? 0.4 : 1,
                              transform: isDragging ? 'scale(0.98)' : 'scale(1)',
                              cursor: 'grab',
                              transition: 'all 150ms ease'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                              <span className="task-status-blue" style={{ fontSize: '0.62rem', padding: '0.15rem 0.4rem' }}>{enq.projectType}</span>
                              {(() => {
                                const t = getTempDetails(enq.leadTemperature || enq.priority);
                                return (
                                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: t.color }}>
                                    {t.emoji} {t.label}
                                  </span>
                                );
                              })()}
                            </div>

                            <div
                              title={enq.projectName}
                              style={{ fontWeight: 700, fontSize: '0.925rem', color: '#1F1F1F', marginBottom: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                              {enq.projectName}
                            </div>

                            <div
                              title={`Client: ${enq.clientName}${enq.architectName ? ` · Architect: ${enq.architectName}` : ''}`}
                              style={{ fontSize: '0.78rem', color: '#4a4742', marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                              Client: {enq.clientName}
                            </div>

                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d', marginBottom: '0.5rem' }}>
                              ₹{Number(enq.estimatedValue || 0).toLocaleString()}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0ece4', paddingTop: '0.5rem', marginTop: '0.5rem', fontSize: '0.725rem' }}>
                              <span style={{ color: '#8c8882', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }} title={execName}>
                                BDE: <b>{execName}</b>
                              </span>
                              <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                {enq.status === 'Won' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleConvertEnquiry(enq); }}
                                    className="btn btn-primary"
                                    disabled={convertingId === enq._id}
                                    style={{ padding: '0.25rem 0.45rem', fontSize: '0.68rem', backgroundColor: '#B68D40', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                    title="Convert Won Enquiry into Active Client"
                                  >
                                    {convertingId === enq._id ? (
                                      <><Loader2 className="animate-spin" size={11} /> Converting...</>
                                    ) : (
                                      <>🚀 Convert</>
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedEnquiry(enq); setIsDetailModalOpen(true); }}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.45rem', fontSize: '0.68rem' }}
                                >
                                  Details
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal for Creating New Enquiry */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={resetCreateEnquiryForm}
        title="Add New Business Development Enquiry"
        footer={
          <>
            <button className="btn btn-secondary" onClick={resetCreateEnquiryForm} disabled={submitting}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateEnquiry} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              {submitting ? <><Loader2 className="animate-spin" size={14} /> Creating...</> : 'Create Enquiry'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateEnquiry} noValidate>
          <FormField
            label="Client Name"
            name="clientName"
            placeholder="e.g. Vistara Builders"
            value={newEnquiry.clientName}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, clientName: e.target.value })}
            error={formErrors.clientName}
            required
          />
          <FormField
            label="Architect Name (Optional)"
            name="architectName"
            placeholder="e.g. Anil Salve & Associates"
            value={newEnquiry.architectName}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, architectName: e.target.value })}
          />
          <FormField
            label="Project Name"
            name="projectName"
            placeholder="e.g. Vistara Elegance Towers"
            value={newEnquiry.projectName}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, projectName: e.target.value })}
            error={formErrors.projectName}
            required
          />
          <FormField
            label="Project Scope Type"
            name="projectType"
            type="select"
            value={newEnquiry.projectType}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, projectType: e.target.value })}
            required
          >
            {PROJECT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
          </FormField>
          <FormField
            label="Estimated Value (₹ INR)"
            name="estimatedValue"
            type="number"
            placeholder="e.g. 1250000"
            value={newEnquiry.estimatedValue}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, estimatedValue: e.target.value })}
          />
          <FormField
            label="Assigned BD Executive"
            name="assignedExecutive"
            type="select"
            value={newEnquiry.assignedExecutive}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, assignedExecutive: e.target.value })}
            error={formErrors.assignedExecutive}
            required
          >
            {executives.map(ex => <option key={ex._id} value={ex._id}>{ex.name} ({ex.email})</option>)}
          </FormField>
          <FormField
            label="Lead Temperature"
            name="leadTemperature"
            type="select"
            value={newEnquiry.leadTemperature || 'Warm'}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, leadTemperature: e.target.value })}
          >
            {LEAD_TEMPERATURES.map(lt => <option key={lt} value={lt}>{lt}</option>)}
          </FormField>
          <FormField
            label="Source of Enquiry"
            name="source"
            placeholder="e.g. Direct Referral, Website, Expo"
            value={newEnquiry.source}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, source: e.target.value })}
          />
          <FormField
            label="Notes & Scope Description"
            name="notes"
            type="textarea"
            placeholder="Key requirements and visualization scope..."
            value={newEnquiry.notes}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, notes: e.target.value })}
          />
        </form>
      </Modal>

      {/* Modal for Editing Business Development Enquiry */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={resetEditEnquiryForm}
        title="Edit Business Development Enquiry"
        footer={
          <>
            <button className="btn btn-secondary" onClick={resetEditEnquiryForm} disabled={submitting}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpdateEnquiry} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              {submitting ? <><Loader2 className="animate-spin" size={14} /> Updating...</> : 'Update Enquiry'}
            </button>
          </>
        }
      >
        <form onSubmit={handleUpdateEnquiry} noValidate>
          <FormField
            label="Client Name (Company / Individual)"
            name="clientName"
            placeholder="e.g. Mahavir Properties"
            value={newEnquiry.clientName}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, clientName: e.target.value })}
            error={formErrors.clientName}
            required
          />
          <FormField
            label="Architect / Principal Designer"
            name="architectName"
            placeholder="e.g. Ar. Rajesh Shah"
            value={newEnquiry.architectName}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, architectName: e.target.value })}
          />
          <FormField
            label="Project Title"
            name="projectName"
            placeholder="e.g. Mahavir One Commercial Hub"
            value={newEnquiry.projectName}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, projectName: e.target.value })}
            error={formErrors.projectName}
            required
          />
          <FormField
            label="Project Scope Category"
            name="projectType"
            type="select"
            value={newEnquiry.projectType}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, projectType: e.target.value })}
          >
            {PROJECT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
          </FormField>
          <FormField
            label="Estimated Deal Value (₹ INR)"
            name="estimatedValue"
            type="number"
            placeholder="e.g. 180000"
            value={newEnquiry.estimatedValue}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, estimatedValue: e.target.value })}
          />
          <FormField
            label="Pipeline Status Stage"
            name="status"
            type="select"
            value={newEnquiry.status}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, status: e.target.value })}
          >
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </FormField>
          <FormField
            label="Assigned BD Executive"
            name="assignedExecutive"
            type="select"
            value={newEnquiry.assignedExecutive}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, assignedExecutive: e.target.value })}
          >
            {executives.map(exec => <option key={exec._id} value={exec._id}>{exec.name}</option>)}
          </FormField>
          <FormField
            label="Follow-Up Date"
            name="followUpDate"
            type="date"
            value={newEnquiry.followUpDate}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, followUpDate: e.target.value })}
          />
          <FormField
            label="Lead Temperature"
            name="leadTemperature"
            type="select"
            value={newEnquiry.leadTemperature || 'Warm'}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, leadTemperature: e.target.value })}
          >
            {LEAD_TEMPERATURES.map(lt => <option key={lt} value={lt}>{lt}</option>)}
          </FormField>
          <FormField
            label="Source of Enquiry"
            name="source"
            placeholder="e.g. Direct Referral, Website, Expo"
            value={newEnquiry.source}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, source: e.target.value })}
          />
          <FormField
            label="Notes & Scope Description"
            name="notes"
            type="textarea"
            placeholder="Key requirements and visualization scope..."
            value={newEnquiry.notes}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, notes: e.target.value })}
          />
        </form>
      </Modal>

      {/* Enquiry Detail & Activity Timeline Modal */}
      {selectedEnquiry && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`${selectedEnquiry.projectName} — Activity Log & History`}
          footer={
            <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>Close</button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Detail Overview */}
            <div style={{ backgroundColor: '#faf9f6', padding: '1rem', borderRadius: '12px', border: '1px solid #eeeae3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1F1F1F' }}>Client: {selectedEnquiry.clientName}</div>
                  <div style={{ fontSize: '0.8rem', color: '#8c8882', marginTop: '0.2rem' }}>
                    Scope: {selectedEnquiry.projectType} · Priority: {selectedEnquiry.priority} · Category: {selectedEnquiry.clientCategory || 'N/A'}
                  </div>
                </div>
                {selectedEnquiry.followUpDate && (
                  <div style={{ backgroundColor: '#fffbf0', border: '1px solid #f6e6be', color: '#996500', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>📅</span> Next Scheduled Follow-Up: {new Date(selectedEnquiry.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
              </div>
              {selectedEnquiry.notes && (
                <div style={{ fontSize: '0.78rem', color: '#4a4742', marginTop: '0.5rem' }}>
                  Notes: {selectedEnquiry.notes}
                </div>
              )}
            </div>

            {/* Add Activity Entry */}
            <form onSubmit={handleAddActivity} style={{ backgroundColor: '#ffffff', padding: '0.9rem', borderRadius: '12px', border: '1px solid #e9e5dc' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1F1F1F', marginBottom: '0.65rem' }}>
                Log Executive Activity (Call / Meeting / Note)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    value={newActivity.type}
                    onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                    style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #d8d4cb', fontSize: '0.8rem', fontWeight: 600, backgroundColor: '#ffffff', minWidth: '100px' }}
                  >
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Note">Note</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Enter meeting notes or discussion summary..."
                    value={newActivity.description}
                    onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                    className="top-bar-search-input"
                    style={{ flex: 1, minWidth: '180px', fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.65rem 0.85rem', backgroundColor: '#fffdf9', borderRadius: '8px', border: '1px solid #f3eedf' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4a4742', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>📅</span> Schedule Next Follow-Up Date (Auto-sync to Master Calendar)
                  </label>
                  <input
                    type="date"
                    value={newActivity.followUpDate}
                    onChange={(e) => setNewActivity({ ...newActivity, followUpDate: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #d8d4cb', fontSize: '0.8rem', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <button type="submit" className="btn-new-task" style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '0.55rem' }}>
                <MessageSquare size={14} /> Record Activity Entry
              </button>
            </form>

            {/* Activity Logs Timeline */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1F1F1F', marginBottom: '0.65rem' }}>
                Activity History ({selectedEnquiry.activityLog?.length || 0})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '240px', overflowY: 'auto' }}>
                {selectedEnquiry.activityLog && selectedEnquiry.activityLog.length > 0 ? (
                  selectedEnquiry.activityLog.map((log, idx) => (
                    <div key={log._id || idx} style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #eeeae3' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span className="task-status-blue" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                          {log.type}
                        </span>
                        <span style={{ fontSize: '0.725rem', color: '#8c8882', fontFamily: 'monospace' }}>
                          {new Date(log.date || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#1F1F1F', marginBottom: (log.followUpDate || log.nextFollowUpDate) ? '0.35rem' : '0' }}>
                        {log.description}
                      </div>
                      {(log.followUpDate || log.nextFollowUpDate) && (
                        <div style={{ fontSize: '0.725rem', color: '#996500', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#fffbf0', padding: '0.2rem 0.5rem', borderRadius: '4px', width: 'fit-content' }}>
                          <span>📅 Scheduled Follow-Up:</span> {new Date(log.followUpDate || log.nextFollowUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#a19d96' }}>No activity logged yet</div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal for Enquiry Deletion */}
      <Modal
        isOpen={Boolean(deletingEnquiryId)}
        onClose={() => setDeletingEnquiryId(null)}
        title="Confirm Enquiry Deletion"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeletingEnquiryId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmDeleteEnquiry}>Delete Enquiry</button>
          </>
        }
      >
        <p style={{ fontSize: '0.9rem', color: '#1F1F1F', lineHeight: 1.5 }}>
          Are you sure you want to delete this enquiry sales lead record?
        </p>
      </Modal>
    </div>
  );
};
