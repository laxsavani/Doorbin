import React, { useState, useEffect } from 'react';
import { enquiryService } from '../services/enquiryService';
import { userService } from '../services/userService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { validators, focusFirstErrorField } from '../utils/validation';
import { Plus, Search, PhoneCall, TrendingUp, UserCheck, DollarSign, Calendar, MessageSquare, ArrowRight, ShieldCheck, Trash2, Briefcase, Tag, AlertTriangle, Award, Edit3, LayoutGrid, List } from 'lucide-react';
import { useViewMode } from '../hooks/useViewMode';
import './Dashboard.css';

const PROJECT_TYPES = ['Architecture', 'Interior Design', 'Animation'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const CLIENT_CATEGORIES = ['Aspirational', 'Regulation', 'Red Flag'];
const STAGES = ['New Enquiry', 'Qualification', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Project Creation'];

export const Enquiries = () => {
  const [enquiries, setEnquiries] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [summaryReport, setSummaryReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useViewMode();

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
    priority: 'Medium',
    clientCategory: 'Aspirational',
    notes: '',
    status: 'New Enquiry'
  });

  // Activity Log State
  const [newActivity, setNewActivity] = useState({
    type: 'Call',
    description: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchEnquiriesAndExecutives();
  }, []);

  const fetchEnquiriesAndExecutives = async () => {
    setLoading(true);
    try {
      const data = await enquiryService.getEnquiries();
      const usersData = await userService.getUsers();
      const report = await enquiryService.getPipelineSummaryReport();

      let extractedEnquiries = Array.isArray(data) ? data : (data?.enquiries || data?.data || []);
      let extractedUsers = Array.isArray(usersData) ? usersData : (usersData?.users || usersData?.data || []);

      setEnquiries(extractedEnquiries);
      setExecutives(extractedUsers);
      setSummaryReport(report);

      if (extractedUsers.length > 0) {
        setNewEnquiry(prev => ({ ...prev, assignedExecutive: extractedUsers[0]._id }));
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

    try {
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
        priority: 'Medium',
        clientCategory: 'Aspirational',
        notes: '',
        status: 'New Enquiry'
      });
      setIsCreateModalOpen(false);
    } catch (err) {
      setToast({ message: err.message || 'Failed to create enquiry', type: 'error' });
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
      priority: enq.priority || 'Medium',
      clientCategory: enq.clientCategory || 'Aspirational',
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

    try {
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
        activityLog: [activityEntry, ...(selectedEnquiry.activityLog || [])]
      };

      setSelectedEnquiry(updatedEnquiry);
      setEnquiries(enquiries.map(e => e._id === selectedEnquiry._id ? updatedEnquiry : e));
      setNewActivity({ type: 'Call', description: '' });
      setToast({ message: 'Activity log entry added!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to log activity', type: 'error' });
    }
  };

  const [deletingEnquiryId, setDeletingEnquiryId] = useState(null);

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
    const execName = typeof enq.assignedExecutive === 'object' ? enq.assignedExecutive?.name : enq.assignedExecutive;
    const matchesSearch = (
      enq.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enq.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enq.architectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      execName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesStage = selectedStageFilter === 'All' || enq.status === selectedStageFilter;
    return matchesSearch && matchesStage;
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
          </div>

          <button onClick={() => setIsCreateModalOpen(true)} className="btn-new-task">
            <Plus size={16} /> New Enquiry
          </button>
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
                {enquiries.length > 0 ? Math.round((enquiries.filter(e => e.status === 'Won').length / enquiries.length) * 100) : 0}% Rate
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

            {/* Mobile Select Dropdown for Stage Filters */}
            <select
              className="mobile-filter-select"
              value={selectedStageFilter}
              onChange={(e) => setSelectedStageFilter(e.target.value)}
            >
              <option value="All">All Stages ({enquiries.length})</option>
              {STAGES.map((stg) => (
                <option key={stg} value={stg}>
                  {stg} ({enquiries.filter(e => e.status === stg).length})
                </option>
              ))}
            </select>
          </div>

          {/* DUAL VIEW RENDER: STRIPE TABLE OR CARD GRID */}
          {viewMode === 'stripe' ? (
            <div className="team-widget-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#faf9f6', borderBottom: '1px solid #eeeae3', color: '#8c8882', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '1rem 1.25rem' }}>Project & Client</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Type & Priority</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Estimated Value</th>
                    <th style={{ padding: '1rem 1.25rem' }}>BD Executive</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Stage Status</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnquiries.map((enq) => {
                    const execName = typeof enq.assignedExecutive === 'object'
                      ? (enq.assignedExecutive?.name || 'BD Executive')
                      : (executives.find(u => u._id === enq.assignedExecutive)?.name || 'BD Executive');

                    return (
                      <tr key={enq._id} style={{ borderBottom: '1px solid #f2ece4' }}>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ fontWeight: 700, color: '#1a1918' }}>{enq.projectName}</div>
                          <div style={{ fontSize: '0.78rem', color: '#8c8882' }}>Client: {enq.clientName}</div>
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span className="task-status-blue" style={{ fontSize: '0.68rem', marginRight: '0.5rem' }}>{enq.projectType}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: enq.priority === 'High' ? '#dc2626' : '#16a34a' }}>{enq.priority}</span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#15803d' }}>
                          ₹{Number(enq.estimatedValue || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>{execName}</td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span className="status-badge-pill badge-on-track">{enq.status}</span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button onClick={() => { setSelectedEnquiry(enq); setIsDetailModalOpen(true); }} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
                              Details
                            </button>
                            <button onClick={() => handleOpenEditModal(enq)} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem' }}>
                              <Edit3 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="responsive-cards-grid">
            {filteredEnquiries.map((enq) => {
              const execName = typeof enq.assignedExecutive === 'object'
                ? (enq.assignedExecutive?.name || 'BD Executive')
                : (executives.find(u => u._id === enq.assignedExecutive)?.name || 'BD Executive');

              return (
                <div key={enq._id} className="team-widget-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                      <span className="task-status-blue" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                        {enq.projectType}
                      </span>

                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          backgroundColor: enq.priority === 'High' ? '#fef2f2' : (enq.priority === 'Medium' ? '#fffbe6' : '#f0fdf4'),
                          color: enq.priority === 'High' ? '#dc2626' : (enq.priority === 'Medium' ? '#d97706' : '#16a34a'),
                          border: `1px solid ${enq.priority === 'High' ? '#fecaca' : (enq.priority === 'Medium' ? '#fef08a' : '#bbf7d0')}`
                        }}
                      >
                        {enq.priority} Priority
                      </span>
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

                      {enq.clientCategory && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                          <span style={{ color: '#8c8882' }}>CATEGORY:</span>
                          <span style={{ fontWeight: 600, color: enq.clientCategory === 'Red Flag' ? '#dc2626' : '#1F1F1F' }}>
                            {enq.clientCategory}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f2ece4', paddingTop: '0.85rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                        backgroundColor: '#ffffff'
                      }}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <button
                        onClick={() => { setSelectedEnquiry(enq); setIsDetailModalOpen(true); }}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.65rem' }}
                      >
                        <MessageSquare size={14} /> Activity ({enq.activityLog?.length || 0})
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(enq)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.5rem', color: '#10529d' }}
                        title="Edit Enquiry Record"
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        onClick={() => setDeletingEnquiryId(enq._id)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.5rem', color: '#dc2626', borderColor: '#fecaca' }}
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
        )}
      </>
    )}

      {/* Modal for Creating New Enquiry */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Business Development Enquiry"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateEnquiry}>Create Enquiry</button>
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
            label="Lead Priority"
            name="priority"
            type="select"
            value={newEnquiry.priority}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, priority: e.target.value })}
          >
            {PRIORITIES.map(pr => <option key={pr} value={pr}>{pr}</option>)}
          </FormField>
          <FormField
            label="Client Category"
            name="clientCategory"
            type="select"
            value={newEnquiry.clientCategory}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, clientCategory: e.target.value })}
          >
            {CLIENT_CATEGORIES.map(cc => <option key={cc} value={cc}>{cc}</option>)}
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
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Business Development Enquiry"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpdateEnquiry}>Update Enquiry</button>
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
            label="Priority Level"
            name="priority"
            type="select"
            value={newEnquiry.priority}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, priority: e.target.value })}
          >
            {PRIORITIES.map(pr => <option key={pr} value={pr}>{pr}</option>)}
          </FormField>
          <FormField
            label="Client Category"
            name="clientCategory"
            type="select"
            value={newEnquiry.clientCategory}
            onChange={(e) => setNewEnquiry({ ...newEnquiry, clientCategory: e.target.value })}
          >
            {CLIENT_CATEGORIES.map(cc => <option key={cc} value={cc}>{cc}</option>)}
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
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1F1F1F' }}>Client: {selectedEnquiry.clientName}</div>
              <div style={{ fontSize: '0.8rem', color: '#8c8882', marginTop: '0.2rem' }}>
                Scope: {selectedEnquiry.projectType} · Priority: {selectedEnquiry.priority} · Category: {selectedEnquiry.clientCategory || 'N/A'}
              </div>
              {selectedEnquiry.notes && (
                <div style={{ fontSize: '0.78rem', color: '#4a4742', marginTop: '0.35rem' }}>
                  Notes: {selectedEnquiry.notes}
                </div>
              )}
            </div>

            {/* Add Activity Entry */}
            <form onSubmit={handleAddActivity} style={{ backgroundColor: '#ffffff', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e9e5dc' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1F1F1F', marginBottom: '0.5rem' }}>
                Log Executive Activity (Call / Meeting / Note)
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select
                  value={newActivity.type}
                  onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #d8d4cb', fontSize: '0.78rem', fontWeight: 600, backgroundColor: '#ffffff' }}
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
                  style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem 0.75rem' }}
                  required
                />
              </div>
              <button type="submit" className="btn-new-task" style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem', padding: '0.45rem' }}>
                <MessageSquare size={14} /> Record Activity Entry
              </button>
            </form>

            {/* Activity Logs Timeline */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1F1F1F', marginBottom: '0.65rem' }}>
                Activity History ({selectedEnquiry.activityLog?.length || 0})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '220px', overflowY: 'auto' }}>
                {selectedEnquiry.activityLog && selectedEnquiry.activityLog.length > 0 ? (
                  selectedEnquiry.activityLog.map((log) => (
                    <div key={log._id} style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #eeeae3' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span className="task-status-blue" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                          {log.type}
                        </span>
                        <span style={{ fontSize: '0.725rem', color: '#8c8882', fontFamily: 'monospace' }}>
                          {new Date(log.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#1F1F1F' }}>
                        {log.description}
                      </div>
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
