import React, { useState, useEffect } from 'react';
import { projectService } from '../services/projectService';
import { clientService } from '../services/clientService';
import { userService } from '../services/userService';
import { resourceService } from '../services/resourceService';
import { authService } from '../services/authService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { validators, focusFirstErrorField } from '../utils/validation';
import { formatDate } from '../utils/dateUtils';
import { Plus, Search, FolderKanban, CheckCircle2, Clock, Trash2, ShieldCheck, UserCheck, Calendar, DollarSign, Layers, Edit3, LayoutGrid, List, Loader2, ChevronDown, ChevronRight, ChevronUp, User } from 'lucide-react';
import { taskService } from '../services/taskService';
import { useViewMode } from '../hooks/useViewMode';
import { useClockInGuard } from '../hooks/useClockInGuard';
import { Pagination } from '../components/Pagination';
import './Dashboard.css';

const CATEGORIES = ['Architecture', 'Interior Design', 'Animation'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const PROJECT_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Delayed'];

export const Projects = () => {
  const { requireClockIn, ClockInGuardModal } = useClockInGuard();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const currentUser = authService.getCurrentUser();
  const userRoleName = typeof currentUser?.role === 'object'
    ? (currentUser?.role?.name || 'Artist')
    : (currentUser?.role || 'Artist');
  const canManageProjects = userRoleName.toLowerCase() === 'director' || userRoleName.toLowerCase() === 'production manager';

  const [projects, setProjects] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [teamAvailabilityMap, setTeamAvailabilityMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useViewMode();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  // Operations View State
  const [tasksList, setTasksList] = useState([]);
  const [operationsSubView, setOperationsSubView] = useState('project'); // 'project' | 'artist'
  const [operationsCategoryFilter, setOperationsCategoryFilter] = useState('All');
  const [expandedProjectIds, setExpandedProjectIds] = useState({});

  // Modals & Active Project Drawer
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [deletingProjectId, setDeletingProjectId] = useState(null);

  // Form State
  const [newProject, setNewProject] = useState({
    projectName: '',
    client: '',
    projectCategory: 'Architecture',
    projectSubType: '',
    priority: 'Medium',
    budget: '',
    startDate: '',
    endDate: '',
    billingParty: '',
    productionManager: '',
    assignedTeam: [],
    status: 'Not Started'
  });

  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchProjectsClientsUsers();
  }, []);

  useEffect(() => {
    if (isEditModalOpen && editingProject?._id && newProject.startDate && newProject.endDate) {
      fetchTeamAvailability(newProject.startDate, newProject.endDate, editingProject._id);
    } else if (newProject.startDate && newProject.endDate) {
      fetchTeamAvailability(newProject.startDate, newProject.endDate);
    }
  }, [newProject.startDate, newProject.endDate, isEditModalOpen, editingProject?._id]);

  const fetchTeamAvailability = async (from, to, excludeProjectId = null) => {
    if (!from || !to) {
      setTeamAvailabilityMap({});
      return;
    }
    const startObj = new Date(from);
    const endObj = new Date(to);
    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime()) || startObj > endObj) {
      setTeamAvailabilityMap({});
      return;
    }

    const totalDays = Math.max(1, Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 3600 * 24)) + 1);

    try {
      const map = {};

      usersList.forEach(u => {
        const uId = u._id.toString();

        // 1. Find conflicting active projects
        const conflictingProjects = projects.filter(p => {
          if (excludeProjectId && p._id.toString() === excludeProjectId.toString()) return false;
          if (p.status === 'Completed' || p.status === 'Cancelled') return false;
          const teamIds = (p.assignedTeam || []).map(m => (typeof m === 'object' ? m._id?.toString() : m?.toString()));
          if (!teamIds.includes(uId)) return false;

          const pStart = p.startDate ? new Date(p.startDate) : null;
          const pEnd = p.endDate ? new Date(p.endDate) : null;
          if (!pStart || !pEnd) return false;

          return (pStart <= endObj && pEnd >= startObj);
        });

        // 2. Compute day-by-day booked vs free status
        let bookedDaysCount = 0;
        let firstFreeDate = null;
        let lastFreeDate = null;
        let firstBookedDate = null;
        let lastBookedDate = null;

        const cur = new Date(startObj);
        while (cur <= endObj) {
          const isBooked = conflictingProjects.some(p => {
            const pStart = new Date(p.startDate);
            const pEnd = new Date(p.endDate);
            return cur >= pStart && cur <= pEnd;
          });

          if (isBooked) {
            bookedDaysCount++;
            if (!firstBookedDate) firstBookedDate = new Date(cur);
            lastBookedDate = new Date(cur);
          } else {
            if (!firstFreeDate) firstFreeDate = new Date(cur);
            lastFreeDate = new Date(cur);
          }

          cur.setDate(cur.getDate() + 1);
        }

        const freeDaysCount = Math.max(0, totalDays - bookedDaysCount);

        let badgeStatus = 'available'; // 'available' | 'partial' | 'unavailable'
        if (bookedDaysCount >= totalDays || freeDaysCount === 0) {
          badgeStatus = 'unavailable';
        } else if (bookedDaysCount > 0) {
          badgeStatus = 'partial';
        }

        const bookedNames = conflictingProjects.map(p => `"${p.projectName}"`);

        const freeDatesSummary = firstFreeDate && lastFreeDate
          ? `${formatDate(firstFreeDate.toISOString())} - ${formatDate(lastFreeDate.toISOString())}`
          : '';
        const conflictDatesSummary = firstBookedDate && lastBookedDate
          ? `${formatDate(firstBookedDate.toISOString())} - ${formatDate(lastBookedDate.toISOString())}`
          : '';

        map[uId] = {
          name: u.name,
          badgeStatus,
          statusText: badgeStatus === 'unavailable'
            ? `🔴 Unavailable (Fully Booked on ${bookedNames.join(', ')})`
            : badgeStatus === 'partial'
              ? `🟡 ${freeDaysCount} Days Available (${freeDatesSummary})`
              : `🟢 ${totalDays} Days Available (${formatDate(from)} - ${formatDate(to)})`,
          freeDays: freeDaysCount,
          bookedDays: bookedDaysCount,
          totalDays,
          freeDatesSummary,
          conflictDatesSummary,
          isFullyBooked: badgeStatus === 'unavailable',
          isPartial: badgeStatus === 'partial',
          bookedSummary: bookedNames.join(', ')
        };
      });

      setTeamAvailabilityMap(map);
    } catch {
      setTeamAvailabilityMap({});
    }
  };

  const fetchProjectsClientsUsers = async () => {
    setLoading(true);
    try {
      const [data, clientsData, usersData, tasksData] = await Promise.all([
        projectService.getProjects(),
        clientService.getClients(),
        userService.getUsers(),
        taskService.getTasks()
      ]);

      let extractedProjects = Array.isArray(data) ? data : (data?.projects || data?.data || []);
      let extractedClients = Array.isArray(clientsData) ? clientsData : (clientsData?.clients || clientsData?.data || []);
      let extractedUsers = Array.isArray(usersData) ? usersData : (usersData?.users || usersData?.data || []);
      let extractedTasks = Array.isArray(tasksData) ? tasksData : (tasksData?.tasks || tasksData?.data || []);

      setProjects(extractedProjects);
      setClientsList(extractedClients);
      setUsersList(extractedUsers);
      setTasksList(extractedTasks);

      if (extractedClients.length > 0) {
        setNewProject(prev => ({
          ...prev,
          client: extractedClients[0]._id,
          productionManager: extractedUsers[0]?._id || ''
        }));
      }
    } catch (err) {
      setToast({ message: err.message || 'Failed to load project management roster', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!requireClockIn()) return;

    const errors = {};
    const nameErr = validators.required(newProject.projectName, 'Project Name');
    if (nameErr) errors.projectName = nameErr;

    const clientErr = validators.required(newProject.client, 'Client Selection');
    if (clientErr) errors.client = clientErr;

    const pmErr = validators.required(newProject.productionManager, 'Production Manager');
    if (pmErr) errors.productionManager = pmErr;

    const startErr = validators.required(newProject.startDate, 'Start Date');
    if (startErr) errors.startDate = startErr;

    const endErr = validators.required(newProject.endDate, 'End Date');
    if (endErr) errors.endDate = endErr;

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstErrorField(errors);
      return;
    }

    setSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const s = new Date(newProject.startDate);
      const e = new Date(newProject.endDate);
      const calcTotalDays = (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s <= e)
        ? Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1)
        : 0;

      const response = await projectService.createProject({
        ...newProject,
        totalDays: calcTotalDays,
        totalWorkingDays: calcTotalDays,
        budget: Number(newProject.budget || 0)
      });

      const matchedClient = clientsList.find(c => c._id === newProject.client);
      const matchedPM = usersList.find(u => u._id === newProject.productionManager);

      const createdItem = response.project || response || {
        _id: `proj_${Date.now()}`,
        ...newProject,
        client: matchedClient || { companyName: 'Client' },
        productionManager: matchedPM || { name: 'PM' },
        progressPercentage: 0,
        stages: [],
        createdAt: new Date().toISOString()
      };

      setProjects([createdItem, ...projects]);
      setToast({ message: 'Project created and stages auto-instantiated from category template!', type: 'success' });
      setNewProject({
        projectName: '',
        client: clientsList[0]?._id || '',
        projectCategory: 'Architecture',
        projectSubType: '',
        priority: 'Medium',
        budget: '',
        startDate: '',
        endDate: '',
        billingParty: '',
        productionManager: usersList[0]?._id || '',
        assignedTeam: [],
        status: 'Not Started'
      });
      setIsCreateModalOpen(false);
    } catch (err) {
      setToast({ message: err.message || 'Failed to create project', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateProjectForm = () => {
    setNewProject({
      projectName: '',
      client: clientsList[0]?._id || '',
      projectCategory: 'Architecture',
      projectSubType: '',
      priority: 'Medium',
      budget: '',
      startDate: '',
      endDate: '',
      billingParty: '',
      productionManager: usersList[0]?._id || '',
      assignedTeam: [],
      status: 'Not Started'
    });
    setFormErrors({});
    setIsCreateModalOpen(false);
  };

  const resetEditProjectForm = () => {
    setEditingProject(null);
    setFormErrors({});
    setIsEditModalOpen(false);
  };

  const handleOpenEditModal = (proj) => {
    if (!requireClockIn()) return;
    setEditingProject(proj);
    setNewProject({
      projectName: proj.projectName || '',
      client: typeof proj.client === 'object' ? (proj.client?._id || '') : (proj.client || ''),
      projectCategory: proj.projectCategory || 'Architecture',
      projectSubType: proj.projectSubType || '',
      priority: proj.priority || 'Medium',
      budget: proj.budget || '',
      startDate: proj.startDate ? proj.startDate.split('T')[0] : '',
      endDate: proj.endDate ? proj.endDate.split('T')[0] : '',
      billingParty: proj.billingParty || '',
      productionManager: typeof proj.productionManager === 'object' ? (proj.productionManager?._id || '') : (proj.productionManager || ''),
      assignedTeam: Array.isArray(proj.assignedTeam) ? proj.assignedTeam.map(t => typeof t === 'object' ? t._id : t) : [],
      status: proj.status || 'Not Started'
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    if (!editingProject) return;

    const errors = {};
    const nameErr = validators.required(newProject.projectName, 'Project Name');
    if (nameErr) errors.projectName = nameErr;

    const clientErr = validators.required(newProject.client, 'Client');
    if (clientErr) errors.client = clientErr;

    const startErr = validators.required(newProject.startDate, 'Start Date');
    if (startErr) errors.startDate = startErr;

    const endErr = validators.required(newProject.endDate, 'End Date');
    if (endErr) errors.endDate = endErr;

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstErrorField(errors);
      return;
    }

    setSubmitting(true);
    try {
      const s = new Date(newProject.startDate);
      const e = new Date(newProject.endDate);
      const calcTotalDays = (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s <= e)
        ? Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1)
        : 0;

      const updatePayload = {
        ...newProject,
        totalDays: calcTotalDays,
        totalWorkingDays: calcTotalDays,
        budget: Number(newProject.budget || 0)
      };

      const response = await projectService.updateProject(editingProject._id, updatePayload);
      const updatedItem = response.project || response;

      const matchedClient = clientsList.find(c => c._id === newProject.client);
      const matchedPM = usersList.find(u => u._id === newProject.productionManager);

      setProjects(projects.map(p => p._id === editingProject._id ? {
        ...p,
        ...updatedItem,
        ...newProject,
        client: matchedClient || p.client,
        productionManager: matchedPM || p.productionManager
      } : p));

      if (selectedProject && selectedProject._id === editingProject._id) {
        setSelectedProject(prev => ({
          ...prev,
          ...newProject,
          client: matchedClient || prev.client,
          productionManager: matchedPM || prev.productionManager
        }));
      }

      setToast({ message: 'Project details updated successfully!', type: 'success' });
      setIsEditModalOpen(false);
      setEditingProject(null);
    } catch (err) {
      setToast({ message: err.message || 'Failed to update project', type: 'error' });
    }
  };

  const handleApproveSubStage = async (subStageId) => {
    if (!selectedProject) return;
    try {
      await projectService.approveSubStage(selectedProject._id, subStageId);

      const updatedStages = (selectedProject.stages || []).map(stg => ({
        ...stg,
        subStages: (stg.subStages || []).map(sub => sub._id === subStageId ? { ...sub, status: 'Approved', completionPercentage: 100 } : sub)
      }));

      const updatedProject = { ...selectedProject, stages: updatedStages, progressPercentage: Math.min(100, selectedProject.progressPercentage + 15) };
      setSelectedProject(updatedProject);
      setProjects(projects.map(p => p._id === selectedProject._id ? updatedProject : p));
      setToast({ message: 'Sub-stage marked as Approved & Completed!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to approve sub-stage', type: 'error' });
    }
  };

  const confirmDeleteProject = async () => {
    if (!deletingProjectId) return;
    try {
      await projectService.deleteProject(deletingProjectId);
      setToast({ message: 'Project marked as deleted (isDeleted: true)', type: 'success' });
      setProjects(projects.filter(p => p._id !== deletingProjectId));
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete project', type: 'error' });
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleDeleteStage = async (stageId) => {
    if (!selectedProject || !window.confirm('Are you sure you want to delete this custom stage?')) return;
    try {
      await projectService.deleteStage(selectedProject._id, stageId);
      setToast({ message: 'Stage deleted successfully', type: 'success' });
      const updatedStages = (selectedProject.stages || []).filter(s => s._id !== stageId);
      const updatedPrj = { ...selectedProject, stages: updatedStages };
      setSelectedProject(updatedPrj);
      setProjects(projects.map(p => p._id === selectedProject._id ? updatedPrj : p));
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete stage', type: 'error' });
    }
  };

  const filteredProjects = projects.filter(p => {
    if (p.isDeleted) return false;
    const clientName = typeof p.client === 'object' ? p.client?.companyName : p.client;
    const pmName = typeof p.productionManager === 'object' ? p.productionManager?.name : p.productionManager;
    const matchesSearch = (
      p.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pmName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesCategory = selectedCategoryFilter === 'All' || p.projectCategory === selectedCategoryFilter;
    const matchesStatus = selectedStatusFilter === 'All' || p.status === selectedStatusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategoryFilter, selectedStatusFilter]);

  const paginatedProjects = filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const artistUsersList = usersList.filter(u => {
    const rName = typeof u.role === 'object' ? (u.role?.name || '') : (u.role || '');
    return !rName || rName.toLowerCase().includes('artist') || rName.toLowerCase().includes('visualizer') || rName.toLowerCase().includes('3d') || rName.toLowerCase().includes('designer');
  });

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      <div className="page-header-responsive">
        <div className="page-header-title-block">
          <h1 className="hero-serif-title">Project Management & Stages</h1>
          <p className="hero-sub-summary">Manage active 3D visualization projects, stage workflows, approvals and team assignments</p>
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

          {canManageProjects && (
            <button onClick={() => requireClockIn(() => setIsCreateModalOpen(true))} className="btn-new-task">
              <Plus size={16} /> New Project
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Loader text="Loading active project roster & stages..." />
      ) : (
        <>
          {/* Search & Filter Bar */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px', maxWidth: '380px' }}>
              <Search size={16} color="#8c8882" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search by project name, client, PM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="top-bar-search-input"
                style={{ width: '100%', paddingLeft: '2.25rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                style={{ padding: '0.45rem 0.85rem', borderRadius: '10px', border: '1px solid #dcd8cf', fontSize: '0.78rem', fontWeight: 600, backgroundColor: '#ffffff', flex: '1 1 auto' }}
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.85rem', borderRadius: '10px', border: '1px solid #dcd8cf', fontSize: '0.78rem', fontWeight: 600, backgroundColor: '#ffffff', flex: '1 1 auto' }}
              >
                <option value="All">All Statuses</option>
                {PROJECT_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
              </select>

              {/* Operations View Toggle Button */}
              <button
                onClick={() => setViewMode(viewMode === 'operations' ? 'stripe' : 'operations')}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #dcd8cf',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  backgroundColor: viewMode === 'operations' ? '#1F1F1F' : '#ffffff',
                  color: viewMode === 'operations' ? '#ffffff' : '#4a4742',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap',
                  flex: '0 0 auto'
                }}
              >
                <Layers size={14} /> Operations
              </button>
            </div>
          </div>

          {/* OPERATIONS VIEW MODE */}
          {viewMode === 'operations' ? (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e8e4dc', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              {/* Header Title & Sub-View Switcher */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <h2 style={{ fontFamily: 'serif', fontStyle: 'italic', fontSize: '1.65rem', margin: 0, fontWeight: 500, color: '#1F1F1F' }}>
                  Operations
                </h2>

                {/* Sub-view Switcher: [ By project ] [ By artist ] */}
                <div style={{ display: 'inline-flex', backgroundColor: '#eae6df', padding: '3px', borderRadius: '8px' }}>
                  <button
                    onClick={() => setOperationsSubView('project')}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      backgroundColor: operationsSubView === 'project' ? '#ffffff' : 'transparent',
                      color: operationsSubView === 'project' ? '#1F1F1F' : '#78746d',
                      boxShadow: operationsSubView === 'project' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    By project
                  </button>
                  <button
                    onClick={() => setOperationsSubView('artist')}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      backgroundColor: operationsSubView === 'artist' ? '#ffffff' : 'transparent',
                      color: operationsSubView === 'artist' ? '#1F1F1F' : '#78746d',
                      boxShadow: operationsSubView === 'artist' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    By artist
                  </button>
                </div>
              </div>

              {/* Category Filter Pills Bar */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {['All projects', 'Architecture / RE', 'Interior Design', 'Animation'].map(cat => {
                  const isSelected = (cat === 'All projects' && (operationsCategoryFilter === 'All' || operationsCategoryFilter === 'All projects')) ||
                    operationsCategoryFilter === cat ||
                    (cat === 'Architecture / RE' && operationsCategoryFilter === 'Architecture');
                  return (
                    <button
                      key={cat}
                      onClick={() => setOperationsCategoryFilter(cat === 'All projects' ? 'All' : (cat === 'Architecture / RE' ? 'Architecture' : cat))}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '9999px',
                        border: '1px solid #dcd8cf',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: isSelected ? '#1F1F1F' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#78746d',
                        cursor: 'pointer'
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* SUB-VIEW 1: BY PROJECT */}
              {operationsSubView === 'project' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {filteredProjects
                    .filter(p => operationsCategoryFilter === 'All' || p.projectCategory === operationsCategoryFilter || (operationsCategoryFilter === 'Architecture' && p.projectCategory?.includes('Architecture')))
                    .map((proj, index) => {
                      const isExpanded = expandedProjectIds[proj._id] !== undefined ? expandedProjectIds[proj._id] : index === 0;
                      const clientName = typeof proj.client === 'object' ? (proj.client?.companyName || proj.client?.clientName) : 'Client';
                      const pmName = typeof proj.productionManager === 'object' ? (proj.productionManager?.name || 'PM') : 'PM';
                      const projTasks = tasksList.filter(t => {
                        const tProjId = typeof t.project === 'object' ? t.project?._id?.toString() : t.project?.toString();
                        return tProjId === proj._id.toString();
                      });

                      const prog = proj.progressPercentage || 0;
                      let progBadge = 'On track';
                      let progBadgeColor = '#16a34a';
                      let progBadgeBg = '#f0fdf4';
                      let barColor = '#B68D40';

                      if (proj.status === 'Delayed' || prog < 30) {
                        progBadge = 'At risk';
                        progBadgeColor = '#dc2626';
                        progBadgeBg = '#fef2f2';
                        barColor = '#dc2626';
                      } else if (prog === 0) {
                        progBadge = 'Kickoff';
                        progBadgeColor = '#8c8882';
                        progBadgeBg = '#f5f5f4';
                        barColor = '#d6d3d1';
                      }

                      const stagesMap = {};
                      projTasks.forEach(t => {
                        const stg = t.stage || t.phase || 'Stage 1 - Scene Prep';
                        if (!stagesMap[stg]) stagesMap[stg] = [];
                        stagesMap[stg].push(t);
                      });

                      return (
                        <div key={proj._id} style={{ border: '1px solid #e8e4dc', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                          {/* Project Header Bar */}
                          <div
                            onClick={() => setExpandedProjectIds(prev => ({ ...prev, [proj._id]: !isExpanded }))}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '0.75rem',
                              padding: '0.85rem 1rem',
                              backgroundColor: '#faf8f5',
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 200px', minWidth: '0' }}>
                              {isExpanded ? <ChevronDown size={18} color="#78746d" style={{ flexShrink: 0 }} /> : <ChevronRight size={18} color="#78746d" style={{ flexShrink: 0 }} />}
                              <div style={{ minWidth: '0', flex: '1 1 auto' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1F1F1F', wordBreak: 'break-word' }}>{proj.projectName}</span>
                                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#8c8882', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{proj.projectCategory}</span>
                                </div>
                                <div style={{ fontSize: '0.725rem', color: '#8c8882', marginTop: '0.15rem', wordBreak: 'break-word' }}>
                                  {clientName} · lead {pmName}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '0 1 auto' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '120px', maxWidth: '100%' }}>
                                <div style={{ flex: 1, height: '6px', backgroundColor: '#e8e4dc', borderRadius: '9999px', overflow: 'hidden' }}>
                                  <div style={{ width: `${prog}%`, height: '100%', backgroundColor: barColor, borderRadius: '9999px', transition: 'width 0.3s ease' }} />
                                </div>
                                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#78746d', minWidth: '28px' }}>{prog}%</span>
                              </div>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.18rem 0.55rem', borderRadius: '9999px', backgroundColor: progBadgeBg, color: progBadgeColor, whiteSpace: 'nowrap' }}>
                                {progBadge}
                              </span>
                            </div>
                          </div>

                          {/* Expanded Project Tasks */}
                          {isExpanded && (
                            <div style={{ padding: '0.75rem 0.85rem 1rem 0.85rem', borderTop: '1px solid #f2ece4' }}>
                              {projTasks.length === 0 ? (
                                <div style={{ padding: '1rem', textAlign: 'center', color: '#8c8882', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                  No task items created for this project yet.
                                </div>
                              ) : (
                                Object.keys(stagesMap).map(stageTitle => (
                                  <div key={stageTitle} style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#78746d', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      {stageTitle}
                                    </div>
                                    <div style={{ overflowX: 'auto', width: '100%' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', minWidth: '450px' }}>
                                        <thead>
                                          <tr style={{ color: '#a39f97', fontSize: '0.65rem', textTransform: 'uppercase', borderBottom: '1px solid #f2ece4', textAlign: 'left' }}>
                                            <th style={{ padding: '0.4rem 0.5rem' }}>TASK</th>
                                            <th style={{ padding: '0.4rem 0.5rem' }}>ASSIGNEE</th>
                                            <th style={{ padding: '0.4rem 0.5rem' }}>START</th>
                                            <th style={{ padding: '0.4rem 0.5rem' }}>END</th>
                                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>DAYS</th>
                                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>STATUS</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {stagesMap[stageTitle].map(t => {
                                            const assigneeObj = typeof t.assignee === 'object' ? t.assignee : usersList.find(u => u._id === t.assignee);
                                            const aName = assigneeObj?.name || 'Unassigned';
                                            const initials = aName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                            const sDate = t.startDate ? formatDate(t.startDate) : '-';
                                            const eDate = t.endDate ? formatDate(t.endDate) : (t.dueDate ? formatDate(t.dueDate) : '-');
                                            
                                            let days = '-';
                                            if (t.startDate && (t.endDate || t.dueDate)) {
                                              const s = new Date(t.startDate);
                                              const e = new Date(t.endDate || t.dueDate);
                                              if (!isNaN(s) && !isNaN(e) && e >= s) {
                                                days = Math.max(1, Math.round((e - s) / 86400000) + 1);
                                              }
                                            }

                                            let stBg = '#f5f5f4';
                                            let stColor = '#78746d';
                                            if (t.status === 'Completed' || t.status === 'Done') {
                                              stBg = '#f0fdf4';
                                              stColor = '#16a34a';
                                            } else if (t.status === 'In Progress') {
                                              stBg = '#e0f2fe';
                                              stColor = '#0284c7';
                                            } else if (t.status === 'Review') {
                                              stBg = '#fffbebf0';
                                              stColor = '#b45309';
                                            }

                                            return (
                                              <tr key={t._id} style={{ borderBottom: '1px solid #f7f5f0' }}>
                                                <td style={{ padding: '0.5rem', fontWeight: 600, color: '#1F1F1F' }}>{t.taskName}</td>
                                                <td style={{ padding: '0.5rem' }}>
                                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#0284c7', color: '#ffffff', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                      {initials}
                                                    </div>
                                                    <span style={{ fontSize: '0.78rem', color: '#4a4742', fontWeight: 500 }}>{aName}</span>
                                                  </div>
                                                </td>
                                                <td style={{ padding: '0.5rem', color: '#78746d', fontSize: '0.78rem' }}>{sDate}</td>
                                                <td style={{ padding: '0.5rem', color: '#78746d', fontSize: '0.78rem' }}>{eDate}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'center', color: '#78746d', fontSize: '0.78rem', fontWeight: 600 }}>{days}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px', backgroundColor: stBg, color: stColor }}>
                                                    {t.status}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* SUB-VIEW 2: BY ARTIST */}
              {operationsSubView === 'artist' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {usersList
                    .filter(u => {
                      const r = (typeof u.role === 'object' ? u.role?.name : u.role || '').toLowerCase();
                      return r.includes('artist') || r.includes('3d') || r.includes('visualizer') || r.includes('designer') || r.includes('lead') || r.includes('compositor') || r.includes('editor');
                    })
                    .map(artist => {
                      const aId = artist._id.toString();
                      const artistTasks = tasksList.filter(t => {
                        const tAssigneeId = typeof t.assignee === 'object' ? t.assignee?._id?.toString() : t.assignee?.toString();
                        return tAssigneeId === aId;
                      });

                      const activeCount = artistTasks.filter(t => t.status !== 'Completed' && t.status !== 'Done' && t.status !== 'Cancelled').length;
                      const doneCount = artistTasks.filter(t => t.status === 'Completed' || t.status === 'Done').length;
                      const initials = artist.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                      const roleTitle = typeof artist.role === 'object' ? artist.role?.name : (artist.role || 'Artist');

                      return (
                        <div key={aId} style={{ border: '1px solid #e8e4dc', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                          {/* Artist Card Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', padding: '0.85rem 1rem', backgroundColor: '#faf8f5', borderBottom: '1px solid #f2ece4' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0284c7', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {initials}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.925rem', color: '#1F1F1F' }}>{artist.name}</div>
                                <div style={{ fontSize: '0.725rem', color: '#8c8882' }}>{roleTitle}</div>
                              </div>
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#78746d' }}>
                              {activeCount} active · {doneCount} done
                            </div>
                          </div>

                          {/* Artist Tasks Table */}
                          <div style={{ padding: '0.5rem 0.85rem 1rem 0.85rem', overflowX: 'auto' }}>
                            {artistTasks.length === 0 ? (
                              <div style={{ padding: '0.75rem', textAlign: 'center', color: '#8c8882', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                No active tasks assigned to {artist.name}.
                              </div>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', minWidth: '340px' }}>
                                <tbody>
                                  {artistTasks.map(t => {
                                    const projObj = typeof t.project === 'object' ? t.project : projects.find(p => p._id === t.project);
                                    const pName = projObj?.projectName || 'Project';
                                    const dueStr = t.dueDate ? formatDate(t.dueDate) : (t.endDate ? formatDate(t.endDate) : '-');

                                    let stBg = '#f5f5f4';
                                    let stColor = '#78746d';
                                    if (t.status === 'Completed' || t.status === 'Done') {
                                      stBg = '#f0fdf4';
                                      stColor = '#16a34a';
                                    } else if (t.status === 'In Progress') {
                                      stBg = '#e0f2fe';
                                      stColor = '#0284c7';
                                    } else if (t.status === 'Review') {
                                      stBg = '#fffbebf0';
                                      stColor = '#b45309';
                                    }

                                    return (
                                      <tr key={t._id} style={{ borderBottom: '1px solid #f7f5f0' }}>
                                        <td style={{ padding: '0.55rem 0.5rem', fontWeight: 600, color: '#1F1F1F' }}>{t.taskName}</td>
                                        <td style={{ padding: '0.55rem 0.5rem', color: '#78746d', fontSize: '0.78rem', textAlign: 'right' }}>{pName}</td>
                                        <td style={{ padding: '0.55rem 0.5rem', color: '#78746d', fontSize: '0.78rem', textAlign: 'right' }}>{dueStr}</td>
                                        <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', width: '100px' }}>
                                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px', backgroundColor: stBg, color: stColor }}>
                                            {t.status}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : viewMode === 'stripe' ? (
            <div className="team-widget-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#faf9f6', borderBottom: '1px solid #eeeae3', color: '#8c8882', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'left' }}>Project Name</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>Client & PM</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>Progress</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>BUDGET (₹)</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProjects.map((proj) => {
                    const clientName = typeof proj.client === 'object' ? (proj.client?.companyName || proj.client?.clientName) : 'Client';
                    const pmName = typeof proj.productionManager === 'object' ? (proj.productionManager?.name || 'PM') : 'PM';

                    return (
                      <tr
                        key={proj._id}
                        onClick={() => { setSelectedProject(proj); setIsDetailModalOpen(true); }}
                        style={{ borderBottom: '1px solid #f2ece4', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'left', wordBreak: 'break-word' }}>
                          <div style={{ fontWeight: 700, color: '#1a1918' }}>{proj.projectName}</div>
                          <span className="task-status-blue" style={{ fontSize: '0.65rem' }}>{proj.projectCategory}</span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center', fontWeight: 600, color: '#4a4742' }}>
                          <div>{clientName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#8c8882' }}>PM: {pmName}</div>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center', fontWeight: 700, color: '#B68D40' }}>
                          {proj.progressPercentage || 0}%
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center', fontWeight: 700, color: '#15803d' }}>
                          ₹{Number(proj.budget || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <span className={`status-badge-pill ${proj.status === 'Completed' ? 'badge-on-track' : 'badge-at-risk'}`}>
                            {proj.status}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedProject(proj); setIsDetailModalOpen(true); }} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
                              Details
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleOpenEditModal(proj); }} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem' }}>
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
              {paginatedProjects.map((proj) => {
                const clientName = typeof proj.client === 'object' ? (proj.client?.companyName || proj.client?.clientName) : 'Client';
                const pmName = typeof proj.productionManager === 'object' ? (proj.productionManager?.name || 'PM') : 'PM';

                return (
                  <div
                    key={proj._id}
                    className="team-widget-card"
                    onClick={() => { setSelectedProject(proj); setIsDetailModalOpen(true); }}
                    style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <span className="task-status-blue" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                          {proj.projectCategory}
                        </span>
                        <span className={`status-badge-pill ${proj.status === 'Completed' ? 'badge-on-track' : (proj.status === 'In Progress' ? 'badge-on-track' : 'badge-at-risk')}`}>
                          {proj.status}
                        </span>
                      </div>

                      <div className="task-title-bold" style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>
                        {proj.projectName}
                      </div>
                      <div className="task-subtitle-muted" style={{ marginBottom: '0.5rem' }}>
                        Client: {clientName} · PM: {pmName}
                      </div>

                      {/* Assigned Team Members (1, 2, 3, 4+ Persons) */}
                      {proj.assignedTeam && proj.assignedTeam.length > 0 && (
                        <div style={{ marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8c8882' }}>TEAM ({proj.assignedTeam.length}):</span>
                          {proj.assignedTeam.map((member, mIdx) => {
                            const mName = typeof member === 'object' ? (member.name || 'Member') : (usersList.find(u => u._id === member)?.name || 'Member');
                            return (
                              <span key={mIdx} style={{ fontSize: '0.68rem', backgroundColor: '#f5efe6', border: '1px solid #e2ded8', borderRadius: '4px', padding: '0.15rem 0.45rem', color: '#1F1F1F', fontWeight: 600 }}>
                                👤 {mName}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Progress Bar */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#1F1F1F', marginBottom: '0.35rem' }}>
                          <span>WORKFLOW PROGRESS</span>
                          <span style={{ color: '#B68D40' }}>{proj.progressPercentage || 0}%</span>
                        </div>
                        <div style={{ height: '7px', width: '100%', backgroundColor: '#eeeae3', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${proj.progressPercentage || 0}%`, backgroundColor: '#B68D40', transition: 'width 300ms ease' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px solid #f2ece4', paddingTop: '0.75rem', fontSize: '0.78rem', color: '#78746d' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>BUDGET:</span>
                          <span style={{ fontWeight: 700, color: '#15803d' }}>₹{Number(proj.budget || 0).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>TIMELINE:</span>
                          <span>{formatDate(proj.startDate)} — {formatDate(proj.endDate)}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #f2ece4', paddingTop: '0.85rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedProject(proj); setIsDetailModalOpen(true); }}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                      >
                        Details & Stages ({proj.stages?.length || 0})
                      </button>

                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenEditModal(proj); }}
                          style={{ background: 'none', border: 'none', color: '#10529d', cursor: 'pointer', padding: '0.35rem' }}
                          title="Edit Project Details"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingProjectId(proj._id); }}
                          style={{ background: 'none', border: 'none', color: '#c7452e', cursor: 'pointer', padding: '0.35rem' }}
                          title="Delete Project"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode !== 'operations' && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredProjects.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {/* Modal for Creating Project */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={resetCreateProjectForm}
        title="Create New Visualization Project"
        footer={
          <>
            <button className="btn btn-secondary" onClick={resetCreateProjectForm} disabled={submitting}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateProject} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              {submitting ? <><Loader2 className="animate-spin" size={14} /> Creating...</> : 'Create Project'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateProject} noValidate>
          <FormField
            label="Project Name"
            name="projectName"
            placeholder="e.g. Hillcrest Luxury Villa Walkthrough"
            value={newProject.projectName}
            onChange={(e) => setNewProject({ ...newProject, projectName: e.target.value })}
            error={formErrors.projectName}
            required
          />
          <FormField
            label="Client"
            name="client"
            type="select"
            value={newProject.client}
            onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
            error={formErrors.client}
            required
          >
            {clientsList.map(c => <option key={c._id} value={c._id}>{c.companyName} ({c.clientName})</option>)}
          </FormField>
          <FormField
            label="Project Category"
            name="projectCategory"
            type="select"
            value={newProject.projectCategory}
            onChange={(e) => setNewProject({ ...newProject, projectCategory: e.target.value })}
            required
          >
            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </FormField>
          <FormField
            label="Project Sub Type"
            name="projectSubType"
            placeholder="e.g. 3D Visualization & VR Walkthrough"
            value={newProject.projectSubType}
            onChange={(e) => setNewProject({ ...newProject, projectSubType: e.target.value })}
          />
          <FormField
            label="Production Manager (PM)"
            name="productionManager"
            type="select"
            value={newProject.productionManager}
            onChange={(e) => setNewProject({ ...newProject, productionManager: e.target.value })}
            error={formErrors.productionManager}
            required
          >
            {usersList
              .filter(u => {
                const r = (typeof u.role === 'object' ? u.role?.name : u.role || '').toLowerCase();
                return r.includes('production') || r.includes('manager') || r.includes('director') || r === 'pm';
              })
              .concat(usersList.filter(u => {
                const r = (typeof u.role === 'object' ? u.role?.name : u.role || '').toLowerCase();
                return !(r.includes('production') || r.includes('manager') || r.includes('director') || r === 'pm');
              }).length === usersList.length ? [] : [])
              .map(u => <option key={u._id} value={u._id}>{u.name} ({typeof u.role === 'object' ? u.role?.name : u.role})</option>)}
          </FormField>
          <FormField
            label="Budget Amount (₹ INR)"
            name="budget"
            type="number"
            placeholder="e.g. 1850000"
            value={newProject.budget}
            onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
          />
          <FormField
            label="Start Date"
            name="startDate"
            type="date"
            value={newProject.startDate}
            onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
            error={formErrors.startDate}
            required
          />
          <FormField
            label="End Date"
            name="endDate"
            type="date"
            value={newProject.endDate}
            onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
            error={formErrors.endDate}
            required
          />
          {newProject.startDate && newProject.endDate && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.65rem 0.85rem',
              backgroundColor: '#f5efe6',
              borderRadius: '8px',
              border: '1px solid #e2ded8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem'
            }}>
              <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>📅 Calculated Project Duration:</span>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1F1F1F' }}>
                {(() => {
                  const s = new Date(newProject.startDate);
                  const e = new Date(newProject.endDate);
                  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return '0 Days';
                  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
                  return `${days} Days (${formatDate(newProject.startDate)} to ${formatDate(newProject.endDate)})`;
                })()}
              </span>
            </div>
          )}
          <FormField
            label="Priority Level"
            name="priority"
            type="select"
            value={newProject.priority}
            onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })}
          >
            {PRIORITIES.map(pr => <option key={pr} value={pr}>{pr}</option>)}
          </FormField>

          {/* Project Team Members Assignment */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', color: '#1F1F1F' }}>
              Assign Project Team Members (Live Availability Check)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2ded8', borderRadius: '8px', padding: '0.75rem', backgroundColor: '#faf8f5' }}>
              {artistUsersList.map(u => {
                const uId = u._id.toString();
                const isSelected = (newProject.assignedTeam || []).includes(uId);
                const avail = teamAvailabilityMap[uId];

                let badgeText = '🟢 Available';
                let badgeBg = '#f0fdf4';
                let badgeColor = '#16a34a';

                if (avail) {
                  if (avail.badgeStatus === 'unavailable') {
                    badgeText = `🔴 Unavailable (Booked on ${avail.bookedSummary || 'another project'})`;
                    badgeBg = '#fef2f2';
                    badgeColor = '#dc2626';
                  } else if (avail.badgeStatus === 'partial') {
                    const datesInfo = avail.freeDatesSummary ? `Free: ${avail.freeDatesSummary}` : `${avail.bookedDays} Days Conflict`;
                    badgeText = `🟡 ${avail.freeDays} Days Available (${datesInfo})`;
                    badgeBg = '#fffbebf0';
                    badgeColor = '#b45309';
                  } else {
                    const rangeInfo = avail.freeDatesSummary ? ` (${avail.freeDatesSummary})` : '';
                    badgeText = `🟢 ${avail.freeDays || avail.totalDays || ''} Days Available${rangeInfo}`;
                    badgeBg = '#f0fdf4';
                    badgeColor = '#16a34a';
                  }
                }

                return (
                  <label key={uId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.825rem', cursor: 'pointer', padding: '0.35rem 0.5rem', borderRadius: '6px', backgroundColor: isSelected ? '#f5efe6' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const currentTeam = newProject.assignedTeam || [];
                          if (e.target.checked) {
                            if (avail?.badgeStatus === 'unavailable') {
                              setToast({ message: `Warning: ${u.name} is fully booked / unavailable from ${newProject.startDate} to ${newProject.endDate}!`, type: 'error' });
                            } else if (avail?.badgeStatus === 'partial') {
                              setToast({ message: `Notice: ${u.name} is only available for ${avail.freeDays} days out of ${avail.totalDays} days in this date range (${avail.bookedDays} days booked in another project/task).`, type: 'info' });
                            }
                            setNewProject({ ...newProject, assignedTeam: [...currentTeam, uId] });
                          } else {
                            setNewProject({ ...newProject, assignedTeam: currentTeam.filter(id => id !== uId) });
                          }
                        }}
                      />
                      <span style={{ fontWeight: 600, color: '#1F1F1F' }}>{u.name} ({u.role?.name || 'Artist'})</span>
                    </div>

                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '9999px',
                      backgroundColor: badgeBg,
                      color: badgeColor
                    }}>
                      {badgeText}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal for Editing Project Details */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={resetEditProjectForm}
        title="Edit Visualization Project Details"
        footer={
          <>
            <button className="btn btn-secondary" onClick={resetEditProjectForm} disabled={submitting}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpdateProject} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              {submitting ? <><Loader2 className="animate-spin" size={14} /> Updating...</> : 'Update Project'}
            </button>
          </>
        }
      >
        <form onSubmit={handleUpdateProject} noValidate>
          <FormField
            label="Project Name"
            name="projectName"
            placeholder="e.g. Skyline Residency 3D Architectural Renderings"
            value={newProject.projectName}
            onChange={(e) => setNewProject({ ...newProject, projectName: e.target.value })}
            error={formErrors.projectName}
            required
          />
          <FormField
            label="Client (Company / Entity)"
            name="client"
            type="select"
            value={newProject.client}
            onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
            error={formErrors.client}
            required
          >
            <option value="">Select Client Entity</option>
            {clientsList.map(c => (
              <option key={c._id} value={c._id}>
                {c.companyName} ({c.clientName})
              </option>
            ))}
          </FormField>
          <FormField
            label="Production Manager (PM)"
            name="productionManager"
            type="select"
            value={newProject.productionManager}
            onChange={(e) => setNewProject({ ...newProject, productionManager: e.target.value })}
          >
            <option value="">Select PM</option>
            {usersList
              .filter(u => {
                const r = (typeof u.role === 'object' ? u.role?.name : u.role || '').toLowerCase();
                return r.includes('production') || r.includes('manager') || r.includes('director') || r === 'pm';
              })
              .map(u => (
                <option key={u._id} value={u._id}>
                  {u.name} ({typeof u.role === 'object' ? u.role?.name : u.role})
                </option>
              ))}
          </FormField>
          <FormField
            label="Project Category"
            name="projectCategory"
            type="select"
            value={newProject.projectCategory}
            onChange={(e) => setNewProject({ ...newProject, projectCategory: e.target.value })}
          >
            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </FormField>
          <FormField
            label="Project Status"
            name="status"
            type="select"
            value={newProject.status}
            onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
          >
            {PROJECT_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
          </FormField>
          <FormField
            label="BUDGET (₹)"
            name="budget"
            type="number"
            placeholder="e.g. 150000"
            value={newProject.budget}
            onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
          />
          <FormField
            label="Start Date"
            name="startDate"
            type="date"
            value={newProject.startDate}
            onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
            error={formErrors.startDate}
            required
          />
          <FormField
            label="End Date"
            name="endDate"
            type="date"
            value={newProject.endDate}
            onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
            error={formErrors.endDate}
            required
          />
          {newProject.startDate && newProject.endDate && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.65rem 0.85rem',
              backgroundColor: '#f5efe6',
              borderRadius: '8px',
              border: '1px solid #e2ded8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem'
            }}>
              <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>📅 Calculated Project Duration:</span>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1F1F1F' }}>
                {(() => {
                  const s = new Date(newProject.startDate);
                  const e = new Date(newProject.endDate);
                  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return '0 Days';
                  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
                  return `${days} Days (${formatDate(newProject.startDate)} to ${formatDate(newProject.endDate)})`;
                })()}
              </span>
            </div>
          )}
          <FormField
            label="Priority Level"
            name="priority"
            type="select"
            value={newProject.priority}
            onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })}
          >
            {PRIORITIES.map(pr => <option key={pr} value={pr}>{pr}</option>)}
          </FormField>

          {/* Project Team Members Assignment (Edit Mode) */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', color: '#1F1F1F' }}>
              Assign Project Team Members
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2ded8', borderRadius: '8px', padding: '0.75rem', backgroundColor: '#faf8f5' }}>
              {usersList
                .filter(u => {
                  const r = (typeof u.role === 'object' ? u.role?.name : u.role || '').toLowerCase();
                  return r.includes('artist') || r.includes('3d') || r.includes('visualizer') || r.includes('designer') || r.includes('lead') || r.includes('production') || r.includes('manager');
                })
                .map(u => {
                  const uId = u._id.toString();
                  const isSelected = (newProject.assignedTeam || []).includes(uId);
                  const avail = teamAvailabilityMap[uId];

                  let badgeText = '🟢 Available';
                  let badgeBg = '#f0fdf4';
                  let badgeColor = '#16a34a';

                  if (avail) {
                    if (avail.badgeStatus === 'unavailable') {
                      badgeText = `🔴 Unavailable (Booked on ${avail.bookedSummary || 'another project'})`;
                      badgeBg = '#fef2f2';
                      badgeColor = '#dc2626';
                    } else if (avail.badgeStatus === 'partial') {
                      const datesInfo = avail.freeDatesSummary ? `Free: ${avail.freeDatesSummary}` : `${avail.bookedDays} Days Conflict`;
                      badgeText = `🟡 ${avail.freeDays} Days Available (${datesInfo})`;
                      badgeBg = '#fffbebf0';
                      badgeColor = '#b45309';
                    } else {
                      const rangeInfo = avail.freeDatesSummary ? ` (${avail.freeDatesSummary})` : '';
                      badgeText = `🟢 ${avail.freeDays || avail.totalDays || ''} Days Available${rangeInfo}`;
                      badgeBg = '#f0fdf4';
                      badgeColor = '#16a34a';
                    }
                  }

                  return (
                    <label key={uId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.825rem', cursor: 'pointer', padding: '0.35rem 0.5rem', borderRadius: '6px', backgroundColor: isSelected ? '#f5efe6' : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const currentTeam = newProject.assignedTeam || [];
                            if (e.target.checked) {
                              if (avail?.badgeStatus === 'unavailable') {
                                setToast({ message: `Warning: ${u.name} is fully booked / unavailable from ${newProject.startDate} to ${newProject.endDate}!`, type: 'error' });
                              } else if (avail?.badgeStatus === 'partial') {
                                setToast({ message: `Notice: ${u.name} is only available for ${avail.freeDays} days out of ${avail.totalDays} days in this date range (${avail.bookedDays} days booked in another project/task).`, type: 'info' });
                              }
                              setNewProject({ ...newProject, assignedTeam: [...currentTeam, uId] });
                            } else {
                              setNewProject({ ...newProject, assignedTeam: currentTeam.filter(id => id !== uId) });
                            }
                          }}
                        />
                        <span style={{ fontWeight: 600, color: '#1F1F1F' }}>{u.name} ({u.role?.name || 'Artist'})</span>
                      </div>

                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '9999px',
                        backgroundColor: badgeBg,
                        color: badgeColor
                      }}>
                        {badgeText}
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>
        </form>
      </Modal>

      {/* Full Project Details Modal */}
      {selectedProject && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Project Details — ${selectedProject.projectName}`}
          footer={
            <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>Close</button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Overview Header Block */}
            <div style={{ backgroundColor: '#faf9f6', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #eeeae3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span className="task-status-blue" style={{ fontSize: '0.725rem', textTransform: 'uppercase' }}>
                  {selectedProject.projectCategory}
                </span>
                <span className={`status-badge-pill ${selectedProject.status === 'Completed' ? 'badge-on-track' : 'badge-at-risk'}`}>
                  {selectedProject.status}
                </span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1918' }}>{selectedProject.projectName}</div>
              <div style={{ fontSize: '0.85rem', color: '#4a4742', marginTop: '0.25rem', fontWeight: 600 }}>
                Client: {typeof selectedProject.client === 'object' ? (selectedProject.client?.companyName || selectedProject.client?.clientName) : 'Client'} · PM: {typeof selectedProject.productionManager === 'object' ? (selectedProject.productionManager?.name || 'PM') : 'PM'}
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #eeeae3' }}>
                <div style={{ fontSize: '0.725rem', color: '#8c8882', fontWeight: 600 }}>BUDGET</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#15803d', marginTop: '0.15rem' }}>
                  ₹{Number(selectedProject.budget || 0).toLocaleString()}
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #eeeae3' }}>
                <div style={{ fontSize: '0.725rem', color: '#8c8882', fontWeight: 600 }}>PROGRESS</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#B68D40', marginTop: '0.15rem' }}>
                  {selectedProject.progressPercentage || 0}%
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #eeeae3' }}>
                <div style={{ fontSize: '0.725rem', color: '#8c8882', fontWeight: 600 }}>PRIORITY</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: selectedProject.priority === 'High' ? '#dc2626' : (selectedProject.priority === 'Medium' ? '#d97706' : '#16a34a'), marginTop: '0.15rem' }}>
                  {selectedProject.priority || 'Medium'}
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #eeeae3' }}>
                <div style={{ fontSize: '0.725rem', color: '#8c8882', fontWeight: 600 }}>TIMELINE</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a1918', marginTop: '0.25rem' }}>
                  {formatDate(selectedProject.startDate)} — {formatDate(selectedProject.endDate)}
                </div>
              </div>
            </div>

            {/* Team Members List */}
            {selectedProject.assignedTeam && selectedProject.assignedTeam.length > 0 && (
              <div style={{ backgroundColor: '#ffffff', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #eeeae3' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8c8882', marginBottom: '0.4rem' }}>
                  ASSIGNED TEAM ({selectedProject.assignedTeam.length}):
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {selectedProject.assignedTeam.map((m, idx) => {
                    const name = typeof m === 'object' ? (m.name || 'Member') : (usersList.find(u => u._id === m)?.name || 'Member');
                    return (
                      <span key={idx} style={{ fontSize: '0.75rem', backgroundColor: '#f5efe6', border: '1px solid #e2ded8', borderRadius: '6px', padding: '0.2rem 0.55rem', color: '#1F1F1F', fontWeight: 600 }}>
                        👤 {name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scope / Notes */}
            {selectedProject.notes && (
              <div style={{ backgroundColor: '#ffffff', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #eeeae3' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8c8882', marginBottom: '0.25rem' }}>
                  SCOPE NOTES & DETAILS:
                </div>
                <div style={{ fontSize: '0.85rem', color: '#4a4742', whiteSpace: 'pre-line' }}>{selectedProject.notes}</div>
              </div>
            )}

            {/* Stages List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedProject.stages && selectedProject.stages.length > 0 ? (
                selectedProject.stages.map((stage) => (
                  <div key={stage._id} style={{ border: '1px solid #eeeae3', borderRadius: '12px', padding: '1rem', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1F1F1F' }}>
                        Stage {stage.order}: {stage.stageName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="task-status-blue" style={{ fontSize: '0.68rem' }}>
                          {stage.status} ({stage.completionPercentage}%)
                        </span>
                        <button
                          onClick={() => handleDeleteStage(stage._id)}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.2rem' }}
                          title="Delete Custom Stage"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Sub-stages list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px dashed #eeeae3', paddingTop: '0.75rem' }}>
                      {stage.subStages && stage.subStages.length > 0 ? (
                        stage.subStages.map((sub) => (
                          <div key={sub._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: '#faf9f6', borderRadius: '8px' }}>
                            <div>
                              <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#1F1F1F' }}>{sub.name}</div>
                              {sub.groupLabel && <div style={{ fontSize: '0.725rem', color: '#8c8882' }}>Group: {sub.groupLabel}</div>}
                            </div>

                            {sub.status === 'Approved' ? (
                              <span style={{ fontSize: '0.725rem', color: '#15803d', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle2 size={14} /> Approved
                              </span>
                            ) : (
                              <button
                                onClick={() => handleApproveSubStage(sub._id)}
                                className="btn btn-primary"
                                style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem' }}
                              >
                                <ShieldCheck size={13} /> Approve
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: '#a19d96' }}>No sub-stages initialized</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#78746d', textAlign: 'center', padding: '2rem 0' }}>
                  No stages instantiated yet. Create a stage or apply category template.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingProjectId)}
        onClose={() => setDeletingProjectId(null)}
        title="Confirm Project Deletion"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeletingProjectId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmDeleteProject}>Delete Project</button>
          </>
        }
      >
        <p style={{ fontSize: '0.9rem', color: '#1F1F1F' }}>
          Are you sure you want to delete this project? It will be marked as deleted (`isDeleted: true`).
        </p>
      </Modal>

      <ClockInGuardModal />
    </div>
  );
};

