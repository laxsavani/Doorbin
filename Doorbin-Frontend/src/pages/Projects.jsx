import { enquiryService } from '../services/enquiryService';
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
import { 
  Plus, Search, FolderKanban, CheckCircle2, Clock, Trash2, ShieldCheck, 
  UserCheck, Calendar, Layers, Edit3, LayoutGrid, List, Loader2, 
  ChevronDown, ChevronRight, ChevronUp, User, Sparkles, Check, 
  ChevronsUpDown, Compass, CheckSquare, CornerDownRight
} from 'lucide-react';
import { taskService } from '../services/taskService';
import { useClockInGuard } from '../hooks/useClockInGuard';
import { Pagination } from '../components/Pagination';
import './Dashboard.css';

const CATEGORIES = ['Architecture', 'Interior Design', 'Animation'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const PROJECT_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Delayed'];

// Standard Category Stages Fallback
const CATEGORY_DEFAULT_STAGES = {
  'Architecture': ['Stage 1 — Scene Prep', 'Stage 2 — Sketches & Lighting', 'Stage 3 — Final Render'],
  'Interior Design': ['Stage 1 — Space Planning & Modelling', 'Stage 2 — Materiality & Lighting', 'Stage 3 — Post-Production'],
  'Animation': ['Stage 1 — Storyboard & Pre-Vis', 'Stage 2 — Camera Animation & Shading', 'Stage 3 — Render Passes & Composite']
};

// Avatar Color Generator
const getAvatarColor = (name = '') => {
  const colors = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#dc2626', '#4f46e5', '#0891b2', '#c026d3'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};


// Helper: Calculate dynamic project progress percentage based on stage & task completion
const calculateDynamicProjectProgress = (proj, projTasks = []) => {
  if (proj.status === 'Completed') return 100;
  if (projTasks && projTasks.length > 0) {
    let totalScore = 0;
    projTasks.forEach(t => {
      if (t.status === 'Completed' || t.status === 'Done') {
        totalScore += 100;
      } else if (t.status === 'In Progress' || t.status === 'Under Review') {
        totalScore += 50;
      }
    });
    return Math.min(100, Math.round(totalScore / projTasks.length));
  }
  if (proj.status === 'In Progress') return Math.max(proj.progressPercentage || 0, 10);
  return proj.progressPercentage || 0;
};

// Helper: Calculate stage completion percentage
const calculateStageProgress = (tasks = []) => {
  if (!tasks || tasks.length === 0) return 0;
  let score = 0;
  tasks.forEach(t => {
    if (t.status === 'Completed' || t.status === 'Done') score += 100;
    else if (t.status === 'In Progress' || t.status === 'Under Review') score += 50;
  });
  return Math.min(100, Math.round(score / tasks.length));
};

// Date formatting for Studio PM (e.g. "Jun 29", "Jul 3")
const formatShortDate = (dateVal) => {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Calculate days between two dates
const calcDaysDiff = (startVal, endVal) => {
  if (!startVal || !endVal) return '-';
  const s = new Date(startVal).getTime();
  const e = new Date(endVal).getTime();
  if (isNaN(s) || isNaN(e)) return '-';
  const diff = Math.max(1, Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)));
  return diff;
};

// Helper: Auto-detect Category from Client's Lead
const getCategoryForClient = (clientObj, allEnquiries = [], availableCategories = ['Architecture', 'Interior Design', 'Animation']) => {
  if (!clientObj) return 'Architecture';
  const cId = String(clientObj._id || clientObj.id || '');
  let rawCat = clientObj.defaultProjectType || clientObj.projectType || clientObj.category || clientObj.industry;
  if (!rawCat && clientObj.notes) {
    const notesLower = clientObj.notes.toLowerCase();
    if (notesLower.includes('interior')) rawCat = 'Interior Design';
    else if (notesLower.includes('anim') || notesLower.includes('walkthrough')) rawCat = 'Animation';
    else if (notesLower.includes('arch')) rawCat = 'Architecture';
  }
  if (!rawCat && allEnquiries && allEnquiries.length > 0) {
    const matchedEnq = allEnquiries.find(enq => {
      if (!enq) return false;
      const enqClientId = String(enq.existingClient?._id || enq.existingClient || enq.convertedClient?._id || enq.convertedClient || '');
      if (cId && enqClientId && enqClientId === cId) return true;
      return false;
    });
    if (matchedEnq) {
      rawCat = matchedEnq.projectType || matchedEnq.projectCategory || matchedEnq.category;
    }
  }
  if (rawCat) {
    const found = availableCategories.find(c => c.toLowerCase() === rawCat.trim().toLowerCase());
    if (found) return found;
  }
  return 'Architecture';
};

export const Projects = () => {
  const { requireClockIn, ClockInGuardModal } = useClockInGuard();

  // Authentication & Permissions
  const [currentUser, setCurrentUser] = useState(null);
  const [canManageProjects, setCanManageProjects] = useState(false);
  const [isDirectorOrAdmin, setIsDirectorOrAdmin] = useState(false);

  // Core Data
  const [projects, setProjects] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [enquiriesList, setEnquiriesList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // View Mode: 'operations' (DEFAULT) | 'stripe' | 'card'
  const [viewMode, setViewMode] = useState('operations');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  // Operations View State
  const [tasksList, setTasksList] = useState([]);
  const [operationsSubView, setOperationsSubView] = useState('project'); // 'project' | 'artist'
  const [expandedProjectIds, setExpandedProjectIds] = useState({});
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  // ClickUp-Style Inline Task State
  const [inlineTaskDrafts, setInlineTaskDrafts] = useState({}); // { [stageKey]: { taskName: '', assignee: '', startDate: '', dueDate: '', priority: 'Medium', isOpen: false } }
  const [inlineTaskSubmitting, setInlineTaskSubmitting] = useState({});

  // Modals & Active Project Drawer
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [deletingProjectId, setDeletingProjectId] = useState(null);

  // Quick Inline Add Client Workflow State
  const [isQuickAddClientOpen, setIsQuickAddClientOpen] = useState(false);
  const [quickClientReturnTarget, setQuickClientReturnTarget] = useState(null); // 'create' | 'edit'
  const [quickClientData, setQuickClientData] = useState({
    companyName: '',
    clientName: '',
    email: '',
    phone: '',
    address: '',
    industry: 'Real Estate & Infrastructure'
  });
  const [quickClientErrors, setQuickClientErrors] = useState({});
  const [quickClientSubmitting, setQuickClientSubmitting] = useState(false);

  // Form State (No budget, optional dates, optional architect, no bulk team)
  const [newProject, setNewProject] = useState({
    projectName: '',
    client: '',
    architect: '',
    projectCategory: 'Architecture',
    projectSubType: '',
    priority: 'Medium',
    startDate: '',
    endDate: '',
    billingParty: '',
    productionManager: '',
    status: 'Not Started'
  });

  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchProjectsClientsUsers();
  }, []);

  const fetchProjectsClientsUsers = async () => {
    try {
      setLoading(true);
      const user = authService.getCurrentUser();
      setCurrentUser(user);
      if (user) {
        const role = (typeof user.role === 'object' ? user.role?.name : user.role || '').toLowerCase();
        const isPM = role.includes('production') || role.includes('manager') || role === 'pm';
        const isDir = role.includes('director') || role.includes('admin') || role.includes('owner') || role.includes('lead');
        setCanManageProjects(isPM || isDir);
        setIsDirectorOrAdmin(isDir);
      }

      const [projs, clients, users, tasks, enqs] = await Promise.all([
        projectService.getProjects(),
        clientService.getClients(),
        userService.getUsers(),
        taskService.getTasks(),
        enquiryService.getEnquiries()
      ]);

      const validProjs = Array.isArray(projs) ? projs : (projs.projects || []);
      const validClients = Array.isArray(clients) ? clients : (clients.clients || []);
      const validUsers = Array.isArray(users) ? users : (users.users || []);
      const validTasks = Array.isArray(tasks) ? tasks : (tasks.tasks || []);
      const validEnqs = Array.isArray(enqs) ? enqs : (enqs.enquiries || []);

      setProjects(validProjs.filter(p => !p.isDeleted));
      setClientsList(validClients.filter(c => c.status !== 'Inactive' && c.status !== 'Deactivated'));
      setUsersList(validUsers.filter(u => u.status !== 'Inactive' && u.status !== 'Deactivated'));
      setTasksList(validTasks);
      setEnquiriesList(validEnqs);
    } catch (err) {
      console.error('Error fetching project setup data:', err);
      setToast({ message: 'Failed to load projects roster', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Helper to compute project timeline / estimate from tasks
  const getProjectTimelineEstimate = (proj, projTasks = []) => {
    if (proj.startDate && proj.endDate) {
      return {
        text: `${formatDate(proj.startDate)} - ${formatDate(proj.endDate)}`,
        isEstimate: false
      };
    }

    const validDates = projTasks
      .map(t => t.dueDate || t.endDate || t.startDate)
      .filter(Boolean)
      .map(d => new Date(d).getTime())
      .filter(t => !isNaN(t));

    if (validDates.length > 0) {
      const minMs = Math.min(...validDates);
      const maxMs = Math.max(...validDates);
      return {
        text: `${formatDate(new Date(minMs))} - ${formatDate(new Date(maxMs))}`,
        isEstimate: true
      };
    }

    if (proj.startDate) {
      return { text: `From ${formatDate(proj.startDate)}`, isEstimate: false };
    }

    return { text: 'Est. from tasks', isEstimate: true };
  };

  // Toggle Single Project Expand
  const toggleProjectExpand = (projId) => {
    setExpandedProjectIds(prev => ({
      ...prev,
      [projId]: !prev[projId]
    }));
  };

  // Toggle All Projects Expand/Collapse
  const handleToggleAllStages = () => {
    const nextState = !isAllExpanded;
    setIsAllExpanded(nextState);
    const newExpanded = {};
    projects.forEach(p => {
      newExpanded[p._id] = nextState;
    });
    setExpandedProjectIds(newExpanded);
  };

  // Inline ClickUp-Style Task Creation
  const handleInlineCreateTask = async (projectId, stageId, stageKey) => {
    const draft = inlineTaskDrafts[stageKey] || {};
    if (!draft.taskName || !draft.taskName.trim()) {
      setToast({ message: 'Please enter a task name', type: 'error' });
      return;
    }

    setInlineTaskSubmitting(prev => ({ ...prev, [stageKey]: true }));
    try {
      await taskService.createTask({
        project: projectId,
        stage: stageId || undefined,
        taskName: draft.taskName.trim(),
        assignee: draft.assignee || undefined,
        startDate: draft.startDate || undefined,
        dueDate: draft.dueDate || undefined,
        endDate: draft.dueDate || undefined,
        priority: draft.priority || 'Medium',
        status: 'In Progress'
      });

      const updatedTasks = await taskService.getTasks();
      setTasksList(Array.isArray(updatedTasks) ? updatedTasks : []);

      setInlineTaskDrafts(prev => ({
        ...prev,
        [stageKey]: {
          taskName: '',
          assignee: draft.assignee || '',
          startDate: '',
          dueDate: '',
          priority: 'Medium',
          isOpen: true
        }
      }));

      setToast({ message: `Task "${draft.taskName}" created!`, type: 'success' });
    } catch (err) {
      console.error('Error creating inline task:', err);
      setToast({ message: err.response?.data?.message || 'Failed to create task', type: 'error' });
    } finally {
      setInlineTaskSubmitting(prev => ({ ...prev, [stageKey]: false }));
    }
  };

  // Cycle Task Status on Click (Done -> In Progress -> Not Started)
  const handleCycleTaskStatus = async (taskId, currentStatus) => {
    const statusCycle = {
      'Not Started': 'In Progress',
      'In Progress': 'Done',
      'Done': 'Not Started',
      'Completed': 'Not Started',
      'Under Review': 'Done'
    };
    const nextStatus = statusCycle[currentStatus] || 'In Progress';
    try {
      await taskService.updateTaskStatus(taskId, nextStatus);
      const updatedTasks = await taskService.getTasks();
      setTasksList(Array.isArray(updatedTasks) ? updatedTasks : []);
    } catch (err) {
      setToast({ message: 'Failed to update task status', type: 'error' });
    }
  };

  // Quick Task Delete
  const handleQuickTaskDelete = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await taskService.deleteTask(taskId);
      const updatedTasks = await taskService.getTasks();
      setTasksList(Array.isArray(updatedTasks) ? updatedTasks : []);
      setToast({ message: 'Task deleted', type: 'info' });
    } catch (err) {
      setToast({ message: 'Failed to delete task', type: 'error' });
    }
  };


  // Quick Start / End Project Actions
  const handleQuickStartProject = async (projId) => {
    requireClockIn(async () => {
      try {
        setProjects(prev => prev.map(p => p._id === projId ? { ...p, status: 'In Progress', progressPercentage: Math.max(p.progressPercentage || 0, 10) } : p));
        await projectService.updateProject(projId, {
          status: 'In Progress',
          startDate: new Date().toISOString().split('T')[0]
        });
        const updatedProjs = await projectService.getProjects();
        const validProjs = Array.isArray(updatedProjs) ? updatedProjs : (updatedProjs.projects || []);
        setProjects(validProjs.filter(p => !p.isDeleted));
        setToast({ message: 'Project started! Status is now In Progress', type: 'success' });
      } catch (err) {
        console.error('Error starting project:', err);
        setToast({ message: 'Failed to start project', type: 'error' });
      }
    });
  };

  const handleQuickEndProject = async (projId) => {
    requireClockIn(async () => {
      try {
        setProjects(prev => prev.map(p => p._id === projId ? { ...p, status: 'Completed', progressPercentage: 100 } : p));
        await projectService.updateProject(projId, {
          status: 'Completed',
          endDate: new Date().toISOString().split('T')[0]
        });
        const updatedProjs = await projectService.getProjects();
        const validProjs = Array.isArray(updatedProjs) ? updatedProjs : (updatedProjs.projects || []);
        setProjects(validProjs.filter(p => !p.isDeleted));
        setToast({ message: 'Project completed! Status is now Completed', type: 'success' });
      } catch (err) {
        console.error('Error completing project:', err);
        setToast({ message: 'Failed to complete project', type: 'error' });
      }
    });
  };

  // Validation: projectName, client, productionManager are required. Dates are optional!
  const validateForm = () => {
    const errors = {};
    if (!newProject.projectName.trim()) {
      errors.projectName = 'Project name is required';
    }
    if (!newProject.client) {
      errors.client = 'Client is required';
    }
    if (!newProject.productionManager) {
      errors.productionManager = 'Production Manager is required';
    }
    if (newProject.startDate && newProject.endDate) {
      if (new Date(newProject.startDate) > new Date(newProject.endDate)) {
        errors.endDate = 'End date cannot be earlier than start date';
      }
    }
    return errors;
  };

  // Create Project
  const handleCreateProject = async (e) => {
    if (e) e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      focusFirstErrorField(errors);
      return;
    }

    setSubmitting(true);
    try {
      await projectService.createProject({
        projectName: newProject.projectName.trim(),
        client: newProject.client,
        architect: newProject.architect ? newProject.architect.trim() : undefined,
        projectCategory: newProject.projectCategory,
        projectSubType: newProject.projectSubType ? newProject.projectSubType.trim() : undefined,
        priority: newProject.priority || 'Medium',
        startDate: newProject.startDate || undefined,
        endDate: newProject.endDate || undefined,
        billingParty: newProject.billingParty || undefined,
        productionManager: newProject.productionManager,
        status: newProject.status || 'Not Started'
      });

      const updatedProjs = await projectService.getProjects();
      const validProjs = Array.isArray(updatedProjs) ? updatedProjs : (updatedProjs.projects || []);
      setProjects(validProjs.filter(p => !p.isDeleted));

      setToast({ message: 'Project created and stages auto-instantiated!', type: 'success' });
      resetCreateProjectForm();
    } catch (err) {
      console.error('Error creating project:', err);
      setToast({ message: err.response?.data?.message || 'Failed to create project', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateProjectForm = () => {
    setIsCreateModalOpen(false);
    setNewProject({
      projectName: '',
      client: '',
      architect: '',
      projectCategory: 'Architecture',
      projectSubType: '',
      priority: 'Medium',
      startDate: '',
      endDate: '',
      billingParty: '',
      productionManager: '',
      status: 'Not Started'
    });
    setFormErrors({});
  };

  // Quick Client Create
  const handleQuickCreateClient = async (e) => {
    if (e) e.preventDefault();
    const errors = {};
    if (!quickClientData.companyName.trim()) errors.companyName = 'Company / Client entity name is required';
    if (!quickClientData.clientName.trim()) errors.clientName = 'Contact person name is required';
    if (quickClientData.email && !validators.email(quickClientData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (Object.keys(errors).length > 0) {
      setQuickClientErrors(errors);
      return;
    }

    setQuickClientSubmitting(true);
    try {
      const created = await clientService.createClient({
        ...quickClientData,
        status: 'Active'
      });

      const newClientId = (created._id || created.id || created.data?._id || created.data?.id)?.toString();
      const updatedClients = await clientService.getClients();
      const validList = Array.isArray(updatedClients) ? updatedClients : (updatedClients.clients || []);
      setClientsList(validList.filter(c => c.status !== 'Inactive' && c.status !== 'Deactivated'));

      if (newClientId) {
        setNewProject(prev => ({
          ...prev,
          client: newClientId
        }));
      }

      setIsQuickAddClientOpen(false);
      setToast({ message: `Client "${quickClientData.companyName}" created and selected!`, type: 'success' });

      if (quickClientReturnTarget === 'edit') {
        setIsEditModalOpen(true);
      } else {
        setIsCreateModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to create client:', err);
      setToast({ message: err.response?.data?.message || 'Failed to create client', type: 'error' });
    } finally {
      setQuickClientSubmitting(false);
    }
  };

  const handleCancelQuickClient = () => {
    setIsQuickAddClientOpen(false);
    if (quickClientReturnTarget === 'edit') {
      setIsEditModalOpen(true);
    } else {
      setIsCreateModalOpen(true);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (proj) => {
    setEditingProject(proj);
    setNewProject({
      projectName: proj.projectName || '',
      client: typeof proj.client === 'object' ? proj.client?._id : (proj.client || ''),
      architect: proj.architect || '',
      projectCategory: proj.projectCategory || 'Architecture',
      projectSubType: proj.projectSubType || '',
      priority: proj.priority || 'Medium',
      startDate: proj.startDate ? String(proj.startDate).split('T')[0] : '',
      endDate: proj.endDate ? String(proj.endDate).split('T')[0] : '',
      billingParty: proj.billingParty || '',
      productionManager: typeof proj.productionManager === 'object' ? proj.productionManager?._id : (proj.productionManager || ''),
      status: proj.status || 'Not Started'
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const resetEditProjectForm = () => {
    setIsEditModalOpen(false);
    setEditingProject(null);
    setNewProject({
      projectName: '',
      client: '',
      architect: '',
      projectCategory: 'Architecture',
      projectSubType: '',
      priority: 'Medium',
      startDate: '',
      endDate: '',
      billingParty: '',
      productionManager: '',
      status: 'Not Started'
    });
    setFormErrors({});
  };

  // Update Project
  const handleUpdateProject = async (e) => {
    if (e) e.preventDefault();
    if (!editingProject) return;

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      focusFirstErrorField(errors);
      return;
    }

    setSubmitting(true);
    try {
      await projectService.updateProject(editingProject._id, {
        projectName: newProject.projectName.trim(),
        client: newProject.client,
        architect: newProject.architect ? newProject.architect.trim() : undefined,
        projectCategory: newProject.projectCategory,
        projectSubType: newProject.projectSubType ? newProject.projectSubType.trim() : undefined,
        priority: newProject.priority,
        startDate: newProject.startDate || undefined,
        endDate: newProject.endDate || undefined,
        billingParty: newProject.billingParty || undefined,
        productionManager: newProject.productionManager,
        status: newProject.status
      });

      const updatedProjs = await projectService.getProjects();
      const validProjs = Array.isArray(updatedProjs) ? updatedProjs : (updatedProjs.projects || []);
      setProjects(validProjs.filter(p => !p.isDeleted));

      setToast({ message: 'Project details updated successfully!', type: 'success' });
      resetEditProjectForm();
    } catch (err) {
      console.error('Error updating project:', err);
      setToast({ message: err.response?.data?.message || 'Failed to update project', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Project
  const confirmDeleteProject = async () => {
    if (!deletingProjectId) return;
    try {
      await projectService.deleteProject(deletingProjectId);
      setProjects(projects.filter(p => p._id !== deletingProjectId));
      setToast({ message: 'Project deleted successfully.', type: 'info' });
      setDeletingProjectId(null);
    } catch (err) {
      console.error('Error deleting project:', err);
      setToast({ message: 'Failed to delete project', type: 'error' });
    }
  };

  // Filtered Projects
  const filteredProjects = projects.filter(p => {
    const clientName = typeof p.client === 'object' ? (p.client?.companyName || p.client?.clientName) : '';
    const pmName = typeof p.productionManager === 'object' ? p.productionManager?.name : '';
    const archName = p.architect || '';
    const matchSearch = !searchQuery ||
      p.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      archName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pmName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchCat = selectedCategoryFilter === 'All' || p.projectCategory === selectedCategoryFilter;
    const matchStatus = selectedStatusFilter === 'All' || p.status === selectedStatusFilter;

    return matchSearch && matchCat && matchStatus;
  });

  return (
    <div className="dashboard-layout-content smooth-fade-in" style={{ padding: '1.25rem 2rem' }}>
      {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />}

      {/* Header Bar */}
      <div className="page-header-responsive" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="hero-serif-title">Projects</h1>
          <p className="hero-sub-summary">Manage active 3D visualization projects, stage workflows, and ClickUp-style inline tasks</p>
        </div>

        <div className="page-header-actions">
          {/* Tri-View Toggle: Operations | Stripe View | Card View */}
          <div className="view-toggle-container">
            <button
              className={`view-toggle-btn ${viewMode === 'operations' ? 'active' : ''}`}
              onClick={() => setViewMode('operations')}
            >
              <Layers size={14} /> Operations
            </button>
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
        <Loader text="Loading active projects & stages..." />
      ) : (
        <>
          {/* Search & Filter Bar */}
          <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px', maxWidth: '380px' }}>
              <Search size={16} color="#8A857D" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search projects, client, architect..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="top-bar-search-input"
                style={{ width: '100%', paddingLeft: '2.25rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.85rem', borderRadius: '10px', border: '1px solid #ECE9E4', fontSize: '0.78rem', fontWeight: 600, backgroundColor: '#FFFFFF', color: '#1C1A17' }}
              >
                <option value="All">All Statuses</option>
                {PROJECT_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
          </div>

          {/* Category Pill Filters (Studio PM Exact Image Style) */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {['All', 'Architecture', 'Interior Design', 'Animation'].map(cat => {
              const isSelected = selectedCategoryFilter === cat;
              const label = cat === 'All' ? 'All projects' : (cat === 'Architecture' ? 'Architecture / RE' : cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(cat)}
                  style={{
                    border: isSelected ? '1px solid #1C1A17' : '1px solid #ECE9E4',
                    cursor: 'pointer',
                    padding: '6px 16px',
                    borderRadius: '99px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    backgroundColor: isSelected ? '#1C1A17' : '#FFFFFF',
                    color: isSelected ? '#FAF9F7' : '#55504A',
                    boxShadow: isSelected ? '0 1px 3px rgba(28,26,23,0.12)' : 'none',
                    transition: 'all 150ms ease'
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* VIEW MODE 1: OPERATIONS / CLICKUP STAGE VIEW (EXACT STUDIO PM IMAGE 2) */}
          {viewMode === 'operations' ? (
            <div>
              {/* Top Controls: Expand/Collapse All on Left, Sub-view Switcher on Right */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={handleToggleAllStages}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: '1px solid #ECE9E4',
                    backgroundColor: '#FFFFFF',
                    color: '#1C1A17',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(28,26,23,0.03)'
                  }}
                >
                  <ChevronsUpDown size={13} color="#8A857D" /> {isAllExpanded ? 'Collapse All Stages' : 'Expand All Stages'}
                </button>

                {/* Sub-view Switcher: [ By project ] [ By artist ] */}
                <div style={{ display: 'inline-flex', backgroundColor: '#F1EEE9', border: '1px solid #ECE9E4', padding: '3px', borderRadius: '8px', gap: '3px' }}>
                  <button
                    onClick={() => setOperationsSubView('project')}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      backgroundColor: operationsSubView === 'project' ? '#FFFFFF' : 'transparent',
                      color: operationsSubView === 'project' ? '#1C1A17' : '#8A857D',
                      boxShadow: operationsSubView === 'project' ? '0 1px 3px rgba(28,26,23,0.08)' : 'none',
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
                      backgroundColor: operationsSubView === 'artist' ? '#FFFFFF' : 'transparent',
                      color: operationsSubView === 'artist' ? '#1C1A17' : '#8A857D',
                      boxShadow: operationsSubView === 'artist' ? '0 1px 3px rgba(28,26,23,0.08)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    By artist
                  </button>
                </div>
              </div>

              {/* SUB-VIEW 1: BY PROJECT (Pixel Perfect Studio PM Image 2) */}
              {operationsSubView === 'project' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {filteredProjects.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#8A857D', fontSize: '0.9rem', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #ECE9E4' }}>
                      No active projects match your filters.
                    </div>
                  ) : (
                    filteredProjects.map((proj, index) => {
                      const isExpanded = expandedProjectIds[proj._id] !== undefined ? expandedProjectIds[proj._id] : (index === 0 || isAllExpanded);
                      const clientName = typeof proj.client === 'object' ? (proj.client?.companyName || proj.client?.clientName) : 'Client';
                      const pmName = typeof proj.productionManager === 'object' ? (proj.productionManager?.name || 'PM') : 'PM';
                      const projTasks = tasksList.filter(t => {
                        const tProjId = typeof t.project === 'object' ? t.project?._id?.toString() : t.project?.toString();
                        return tProjId === proj._id.toString();
                      });

                      const prog = calculateDynamicProjectProgress(proj, projTasks);
                      let statusBg = '#EAF5EE';
                      let statusFg = '#2E7D4E';
                      let toneColor = '#C75B39';

                      if (proj.status === 'Delayed' || prog < 30) {
                        statusBg = '#FDF0E9';
                        statusFg = '#C75B39';
                        toneColor = '#C75B39';
                      } else if (proj.status === 'In Progress') {
                        statusBg = '#EBF3FC';
                        statusFg = '#2563EB';
                        toneColor = '#2563EB';
                      } else if (prog === 0) {
                        statusBg = '#F5F2ED';
                        statusFg = '#8A857D';
                        toneColor = '#ECE9E4';
                      }

                      // Always guarantee ALL 3 STAGES for the project category
                      const defaultStages = CATEGORY_DEFAULT_STAGES[proj.projectCategory] || CATEGORY_DEFAULT_STAGES['Architecture'];
                      const stagesMap = {};
                      defaultStages.forEach(stgName => {
                        stagesMap[stgName] = [];
                      });

                      projTasks.forEach(t => {
                        const rawStg = (t.stage?.stageName || t.stage?.name || (typeof t.stage === 'string' ? t.stage : '')) || '';
                        let targetStage = defaultStages[0];
                        if (rawStg.includes('2') || rawStg.toLowerCase().includes('sketch') || rawStg.toLowerCase().includes('lighting') || rawStg.toLowerCase().includes('production') && !rawStg.toLowerCase().includes('pre') && !rawStg.toLowerCase().includes('post')) {
                          targetStage = defaultStages[1];
                        } else if (rawStg.includes('3') || rawStg.toLowerCase().includes('final') || rawStg.toLowerCase().includes('render') || rawStg.toLowerCase().includes('post')) {
                          targetStage = defaultStages[2];
                        } else if (rawStg.includes('1') || rawStg.toLowerCase().includes('scene') || rawStg.toLowerCase().includes('pre') || rawStg.toLowerCase().includes('space')) {
                          targetStage = defaultStages[0];
                        }
                        stagesMap[targetStage].push(t);
                      });

                      return (
                        <div key={proj._id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #ECE9E4', borderRadius: '12px', overflow: 'hidden' }}>
                          {/* Studio PM Style Project Header Row */}
                          <div 
                            onClick={() => toggleProjectExpand(proj._id)}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '14px', 
                              padding: '15px 20px', 
                              cursor: 'pointer',
                              backgroundColor: '#FFFFFF',
                              transition: 'background-color 150ms ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF9F7'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                          >
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#8A857D', width: '14px', textAlign: 'center' }}>
                              {isExpanded ? '▾' : '▸'}
                            </span>

                            <div style={{ flex: '1', minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', minWidth: 0 }}>
                                <span style={{ fontSize: '14.5px', fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1C1A17' }}>
                                  {proj.projectName}
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em', color: '#8A857D', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                  {proj.projectCategory}
                                </span>
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#8A857D', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {clientName} · lead {pmName} {proj.architect ? `· arch ${proj.architect}` : ''}
                              </div>
                            </div>

                            {/* Studio PM Progress Bar (150px) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '150px' }}>
                              <div style={{ flex: 1, height: '4px', borderRadius: '99px', backgroundColor: '#F1EEE9', overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: '99px', backgroundColor: toneColor, width: `${prog}%` }} />
                              </div>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#8A857D' }}>{prog}%</span>
                            </div>

                            {/* Status badge */}
                            <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 9px', borderRadius: '99px', whiteSpace: 'nowrap', backgroundColor: statusBg, color: statusFg }}>
                              {proj.status}
                            </span>

                            {/* Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                              {proj.status === 'Not Started' && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleQuickStartProject(proj._id); }}
                                  style={{ padding: '3px 9px', borderRadius: '6px', border: '1px solid #2563EB', background: '#EBF3FC', color: '#2563EB', fontSize: '11px', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                  title="Start Project"
                                >
                                  ▶ Start Project
                                </button>
                              )}
                              {(proj.status === 'In Progress' || proj.status === 'Delayed' || proj.status === 'On Hold') && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleQuickEndProject(proj._id); }}
                                  style={{ padding: '3px 9px', borderRadius: '6px', border: '1px solid #2E7D4E', background: '#EAF5EE', color: '#2E7D4E', fontSize: '11px', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                  title="End / Complete Project"
                                >
                                  ✓ End Project
                                </button>
                              )}
                              {proj.status === 'Completed' && (
                                <span style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #ECE9E4', background: '#FAF9F7', color: '#8A857D', fontSize: '10.5px', fontWeight: 500 }}>
                                  ✓ Completed
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(proj)}
                                style={{ padding: '4px', borderRadius: '6px', border: '1px solid #ECE9E4', background: '#FFFFFF', color: '#8A857D', cursor: 'pointer', display: 'inline-flex' }}
                                title="Edit Project"
                              >
                                <Edit3 size={12} />
                              </button>
                              {isDirectorOrAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingProjectId(proj._id)}
                                  style={{ padding: '4px', borderRadius: '6px', border: '1px solid #FDF0E9', background: '#FFFFFF', color: '#C75B39', cursor: 'pointer', display: 'inline-flex' }}
                                  title="Delete Project"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expanded Stages & Tasks Table (EXACT STUDIO PM IMAGE 2) */}
                          {isExpanded && (
                            <div style={{ borderTop: '1px solid #ECE9E4' }}>
                              {/* Studio PM Table Header */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '8px 20px 8px 48px', backgroundColor: '#FAF9F7', borderBottom: '1px solid #F1EEE9' }}>
                                <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '0.1em', color: '#B5B0A8', textTransform: 'uppercase' }}>TASK</span>
                                <span style={{ width: '140px', fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '0.1em', color: '#B5B0A8', textTransform: 'uppercase' }}>ASSIGNEE</span>
                                <span style={{ width: '62px', fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '0.1em', color: '#B5B0A8', textTransform: 'uppercase' }}>START</span>
                                <span style={{ width: '62px', fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '0.1em', color: '#B5B0A8', textTransform: 'uppercase' }}>END</span>
                                <span style={{ width: '48px', fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '0.1em', color: '#B5B0A8', textAlign: 'right', textTransform: 'uppercase' }}>DAYS</span>
                                <span style={{ width: '104px', fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '0.1em', color: '#B5B0A8', textAlign: 'right', textTransform: 'uppercase' }}>STATUS</span>
                              </div>

                              {Object.entries(stagesMap).map(([stageName, tasks]) => {
                                const stageKey = `${proj._id}_${stageName}`;
                                const draft = inlineTaskDrafts[stageKey] || { taskName: '', assignee: '', startDate: '', dueDate: '', priority: 'Medium', isOpen: false };
                                const isSubmitting = Boolean(inlineTaskSubmitting[stageKey]);

                                return (
                                  <div key={stageName}>
                                    {/* Stage Section Header (Studio PM style) */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px 7px 48px', fontSize: '12px', fontWeight: 600, color: '#55504A', backgroundColor: '#FCFBFA', borderBottom: '1px solid #F5F2ED' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>{stageName}</span>
                                        {tasks.length > 0 && (
                                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: calculateStageProgress(tasks) === 100 ? '#2E7D4E' : '#8A857D', backgroundColor: calculateStageProgress(tasks) === 100 ? '#EAF5EE' : '#FAF9F7', padding: '1px 6px', borderRadius: '4px', border: '1px solid #ECE9E4' }}>
                                            {calculateStageProgress(tasks)}% ({tasks.filter(t => t.status === 'Completed' || t.status === 'Done').length}/{tasks.length})
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setInlineTaskDrafts(prev => ({
                                          ...prev,
                                          [stageKey]: { ...draft, isOpen: !draft.isOpen }
                                        }))}
                                        style={{
                                          border: 'none',
                                          background: 'transparent',
                                          color: '#C75B39',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px'
                                        }}
                                      >
                                        <Plus size={12} /> Add Task
                                      </button>
                                    </div>

                                    {/* Task Rows in Image 2 Format */}
                                    {tasks.map(t => {
                                      const matchedUser = t.assignee && typeof t.assignee === 'object' ? t.assignee : usersList.find(u => u._id === t.assignee);
                                      const aName = matchedUser?.name || (typeof t.assignee === 'string' && !t.assignee.match(/^[0-9a-fA-F]{24}$/) ? t.assignee : 'Unassigned');
                                      const safeNameStr = String(aName || 'Unassigned');
                                      const firstName = safeNameStr.split(' ')[0] || 'Unassigned';
                                      const initials = (safeNameStr.split(' ').filter(Boolean).map(n => n[0]).join('') || 'U').toUpperCase().slice(0, 2);
                                      const avColor = getAvatarColor(aName);
                                      const startStr = formatShortDate(t.startDate || proj.startDate);
                                      const endStr = formatShortDate(t.dueDate || t.endDate || proj.endDate);
                                      const daysCount = calcDaysDiff(t.startDate || proj.startDate, t.dueDate || t.endDate || proj.endDate);

                                      const isDone = t.status === 'Completed' || t.status === 'Done';
                                      const isInProg = t.status === 'In Progress' || t.status === 'Under Review';
                                      const stLabel = isDone ? 'Done' : (isInProg ? 'In Progress' : 'Not Started');
                                      const stBg = isDone ? '#EAF5EE' : (isInProg ? '#EBF3FC' : '#F5F2ED');
                                      const stFg = isDone ? '#2E7D4E' : (isInProg ? '#2563EB' : '#8A857D');
                                      const taskTextColor = isDone ? '#B5B0A8' : (isInProg ? '#1C1A17' : '#55504A');
                                      const taskTextDecoration = isDone ? 'line-through' : 'none';
                                      const taskFontWeight = isInProg ? 600 : 400;

                                      return (
                                        <div key={t._id} style={{ display: 'flex', alignItems: 'center', padding: '10px 20px 10px 48px', borderBottom: '1px solid #F5F2ED', transition: 'background-color 150ms ease' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF9F7'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                          <span style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: taskFontWeight, color: taskTextColor, textDecoration: taskTextDecoration, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {t.taskName}
                                          </span>
                                          
                                          <div style={{ width: '140px', flex: 'none', display: 'flex', alignItems: 'center', gap: '7px' }}>
                                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: avColor, color: '#FFFFFF', display: 'grid', placeItems: 'center', fontSize: '8px', fontWeight: 600 }}>
                                              {initials}
                                            </div>
                                            <span style={{ fontSize: '11.5px', color: '#55504A' }}>{aName}</span>
                                          </div>

                                          <span style={{ width: '62px', flex: 'none', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#8A857D' }}>
                                            {startStr}
                                          </span>
                                          <span style={{ width: '62px', flex: 'none', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#1C1A17' }}>
                                            {endStr}
                                          </span>
                                          <span style={{ width: '48px', flex: 'none', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#8A857D', textAlign: 'right' }}>
                                            {daysCount}
                                          </span>

                                          <div style={{ width: '104px', flex: 'none', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
                                            <button
                                              type="button"
                                              onClick={() => handleCycleTaskStatus(t._id, stLabel)}
                                              title="Click to cycle status"
                                              style={{
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '10.5px',
                                                fontWeight: 600,
                                                padding: '3px 9px',
                                                borderRadius: '99px',
                                                whiteSpace: 'nowrap',
                                                backgroundColor: stBg,
                                                color: stFg
                                              }}
                                            >
                                              {stLabel}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleQuickTaskDelete(t._id)}
                                              style={{ background: 'none', border: 'none', color: '#B5B0A8', cursor: 'pointer', padding: '2px' }}
                                              title="Delete task"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* ClickUp-Style Clean Inline Add Row */}
                                    {draft.isOpen && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px 8px 48px', backgroundColor: '#FAF9F7', borderBottom: '1px solid #ECE9E4' }}>
                                        <input
                                          type="text"
                                          placeholder="Task name... (press Enter to save)"
                                          value={draft.taskName || ''}
                                          onChange={(e) => setInlineTaskDrafts(prev => ({
                                            ...prev,
                                            [stageKey]: { ...draft, taskName: e.target.value }
                                          }))}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleInlineCreateTask(proj._id, tasks[0]?.stage?._id || tasks[0]?.stage, stageKey);
                                          }}
                                          style={{
                                            flex: 1,
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            border: '1px solid #ECE9E4',
                                            fontSize: '12px',
                                            backgroundColor: '#FFFFFF',
                                            outline: 'none'
                                          }}
                                          autoFocus
                                        />

                                        <select
                                          value={draft.assignee || ''}
                                          onChange={(e) => setInlineTaskDrafts(prev => ({
                                            ...prev,
                                            [stageKey]: { ...draft, assignee: e.target.value }
                                          }))}
                                          style={{ width: '130px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #ECE9E4', fontSize: '11px', backgroundColor: '#FFFFFF' }}
                                        >
                                          <option value="">Assign Artist...</option>
                                          {usersList.map(u => (
                                            <option key={u._id} value={u._id}>{u.name}</option>
                                          ))}
                                        </select>

                                        <input
                                          type="date"
                                          value={draft.startDate || ''}
                                          onChange={(e) => setInlineTaskDrafts(prev => ({
                                            ...prev,
                                            [stageKey]: { ...draft, startDate: e.target.value }
                                          }))}
                                          style={{ width: '105px', padding: '3px 4px', borderRadius: '6px', border: '1px solid #ECE9E4', fontSize: '10px', fontFamily: 'var(--font-mono)', backgroundColor: '#FFFFFF' }}
                                        />

                                        <input
                                          type="date"
                                          value={draft.dueDate || ''}
                                          onChange={(e) => setInlineTaskDrafts(prev => ({
                                            ...prev,
                                            [stageKey]: { ...draft, dueDate: e.target.value }
                                          }))}
                                          style={{ width: '105px', padding: '3px 4px', borderRadius: '6px', border: '1px solid #ECE9E4', fontSize: '10px', fontFamily: 'var(--font-mono)', backgroundColor: '#FFFFFF' }}
                                        />

                                        <button
                                          type="button"
                                          onClick={() => handleInlineCreateTask(proj._id, tasks[0]?.stage?._id || tasks[0]?.stage, stageKey)}
                                          disabled={isSubmitting}
                                          style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            backgroundColor: '#1C1A17',
                                            color: '#FAF9F7',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                          }}
                                        >
                                          {isSubmitting ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Save
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setInlineTaskDrafts(prev => ({
                                            ...prev,
                                            [stageKey]: { ...draft, isOpen: false }
                                          }))}
                                          style={{ background: 'none', border: 'none', color: '#8A857D', cursor: 'pointer', fontSize: '11px', padding: '2px' }}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* SUB-VIEW 2: BY ARTIST */}
              {operationsSubView === 'artist' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {usersList.map(artist => {
                    const aId = artist._id.toString();
                    const artistTasks = tasksList.filter(t => {
                      const tAssigneeId = typeof t.assignee === 'object' ? t.assignee?._id?.toString() : t.assignee?.toString();
                      return tAssigneeId === aId;
                    });

                    const activeCount = artistTasks.filter(t => t.status !== 'Completed' && t.status !== 'Done' && t.status !== 'Cancelled').length;
                    const doneCount = artistTasks.filter(t => t.status === 'Completed' || t.status === 'Done').length;
                    const safeArtistName = String(artist?.name || 'Artist');
                    const initials = (safeArtistName.split(' ').filter(Boolean).map(n => n[0]).join('') || 'A').toUpperCase().slice(0, 2);
                    const roleTitle = typeof artist.role === 'object' ? artist.role?.name : (artist.role || 'Artist');

                    return (
                      <div key={aId} style={{ backgroundColor: '#FFFFFF', border: '1px solid #ECE9E4', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(28,26,23,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', padding: '0.85rem 1.15rem', backgroundColor: '#FAF9F7', borderBottom: '1px solid #ECE9E4' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#1C1A17', color: '#FAF9F7', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {initials}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1C1A17' }}>{artist.name}</div>
                              <div style={{ fontSize: '0.72rem', color: '#8A857D' }}>{roleTitle}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8A857D' }}>
                            {activeCount} active · {doneCount} done
                          </div>
                        </div>

                        <div style={{ padding: '0.5rem 1.15rem 0.85rem 1.15rem', overflowX: 'auto' }}>
                          {artistTasks.length === 0 ? (
                            <div style={{ padding: '0.75rem', textAlign: 'center', color: '#8A857D', fontSize: '0.8rem', fontStyle: 'italic' }}>
                              No active tasks assigned to {artist.name}.
                            </div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '340px' }}>
                              <tbody>
                                {artistTasks.map(t => {
                                  const projObj = typeof t.project === 'object' ? t.project : projects.find(p => p._id === t.project);
                                  const pName = projObj?.projectName || 'Project';
                                  const dueStr = t.dueDate ? formatDate(t.dueDate) : (t.endDate ? formatDate(t.endDate) : '-');

                                  return (
                                    <tr key={t._id} style={{ borderBottom: '1px solid #FAF9F7' }}>
                                      <td style={{ padding: '0.55rem 0.5rem', fontWeight: 500, color: '#1C1A17' }}>{t.taskName}</td>
                                      <td style={{ padding: '0.55rem 0.5rem', color: '#8A857D', fontSize: '0.78rem', textAlign: 'right' }}>{pName}</td>
                                      <td style={{ padding: '0.55rem 0.5rem', color: '#8A857D', fontSize: '0.78rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{dueStr}</td>
                                      <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', width: '100px' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '99px', backgroundColor: t.status === 'Completed' || t.status === 'Done' ? '#EAF5EE' : '#FAF9F7', color: t.status === 'Completed' || t.status === 'Done' ? '#2E7D4E' : '#8A857D' }}>
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
            /* VIEW MODE 2: STRIPE TABLE VIEW (No Budget, With Architect & Estimate Timeline) */
            <div className="team-widget-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAF9F7', borderBottom: '1px solid #ECE9E4', color: '#8A857D', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'left' }}>Project Name & Details</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left' }}>Timeline / Estimate</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left' }}>Production Manager</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '1rem 0.75rem', textAlign: 'left' }}>Progress</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#8A857D' }}>
                        No projects found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((p) => {
                      const clientName = typeof p.client === 'object' ? (p.client?.companyName || p.client?.clientName) : '-';
                      const pmName = typeof p.productionManager === 'object' ? p.productionManager?.name : '-';
                      const projTasks = tasksList.filter(t => {
                        const tProjId = typeof t.project === 'object' ? t.project?._id?.toString() : t.project?.toString();
                        return tProjId === p._id.toString();
                      });
                      const timeline = getProjectTimelineEstimate(p, projTasks);

                      let statusBadgeBg = '#F5F2ED';
                      let statusBadgeColor = '#8A857D';
                      if (p.status === 'Completed') { statusBadgeBg = '#EAF5EE'; statusBadgeColor = '#2E7D4E'; }
                      else if (p.status === 'In Progress') { statusBadgeBg = '#EBF3FC'; statusBadgeColor = '#2563EB'; }
                      else if (p.status === 'Delayed') { statusBadgeBg = '#FDF0E9'; statusBadgeColor = '#C75B39'; }

                      return (
                        <tr key={p._id} style={{ borderBottom: '1px solid #ECE9E4', transition: 'background-color 0.15s ease' }}>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ fontWeight: 600, color: '#1C1A17', fontSize: '13.5px' }}>{p.projectName}</div>
                            <div style={{ fontSize: '11px', color: '#8A857D', marginTop: '2px' }}>
                              Client: {clientName} {p.architect && `· Arch: ${p.architect}`}
                            </div>
                          </td>
                          <td style={{ padding: '1rem 0.75rem' }}>
                            <span className="micro-category-pill">{p.projectCategory}</span>
                          </td>
                          <td style={{ padding: '1rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#1C1A17' }}>
                            {timeline.text} {timeline.isEstimate && <span style={{ color: '#C75B39', fontSize: '10px' }}>(Auto)</span>}
                          </td>
                          <td style={{ padding: '1rem 0.75rem', color: '#1C1A17', fontSize: '12.5px' }}>
                            {pmName}
                          </td>
                          <td style={{ padding: '1rem 0.75rem' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '99px', backgroundColor: statusBadgeBg, color: statusBadgeColor }}>
                              {p.status}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '60px', height: '5px', backgroundColor: '#ECE9E4', borderRadius: '99px', overflow: 'hidden' }}>
                                <div style={{ width: `${calculateDynamicProjectProgress(p, projTasks)}%`, height: '100%', backgroundColor: calculateDynamicProjectProgress(p, projTasks) === 100 ? '#2E7D4E' : '#C75B39' }} />
                              </div>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: '#8A857D' }}>{calculateDynamicProjectProgress(p, projTasks)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                              <button
                                className="btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: '6px' }}
                                onClick={() => { setSelectedProject(p); setIsDetailModalOpen(true); }}
                              >
                                Details
                              </button>
                              <button
                                className="action-icon-btn"
                                onClick={() => handleOpenEditModal(p)}
                                title="Edit Project"
                              >
                                <Edit3 size={14} />
                              </button>
                              {isDirectorOrAdmin && (
                                <button
                                  className="action-icon-btn delete-btn"
                                  onClick={() => setDeletingProjectId(p._id)}
                                  title="Delete Project"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* VIEW MODE 3: CARD VIEW */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {filteredProjects.map((p) => {
                const clientName = typeof p.client === 'object' ? (p.client?.companyName || p.client?.clientName) : '-';
                const pmName = typeof p.productionManager === 'object' ? p.productionManager?.name : '-';
                const projTasks = tasksList.filter(t => {
                  const tProjId = typeof t.project === 'object' ? t.project?._id?.toString() : t.project?.toString();
                  return tProjId === p._id.toString();
                });
                const timeline = getProjectTimelineEstimate(p, projTasks);

                return (
                  <div key={p._id} className="team-widget-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <span className="micro-category-pill">{p.projectCategory}</span>
                          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.4rem 0 0.2rem', color: '#1C1A17' }}>{p.projectName}</h3>
                          <div style={{ fontSize: '0.8rem', color: '#8A857D' }}>{clientName}</div>
                          {p.architect && (
                            <div style={{ fontSize: '0.75rem', color: '#8A857D', marginTop: '2px' }}>
                              <Compass size={11} style={{ display: 'inline', marginRight: '3px' }} /> Arch: {p.architect}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '99px', backgroundColor: '#FAF9F7', border: '1px solid #ECE9E4', color: '#1C1A17' }}>
                          {p.status}
                        </span>
                      </div>

                      <div style={{ margin: '1rem 0', padding: '0.75rem', backgroundColor: '#FAF9F7', borderRadius: '8px', border: '1px solid #ECE9E4' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#8A857D', marginBottom: '0.35rem' }}>
                          <span>Timeline</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#1C1A17' }}>{timeline.text}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#8A857D', marginBottom: '0.35rem' }}>
                          <span>Production Manager</span>
                          <span style={{ fontWeight: 600, color: '#1C1A17' }}>{pmName}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#8A857D' }}>
                          <span>Active Tasks</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#1C1A17' }}>{projTasks.length} tasks</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #ECE9E4', paddingTop: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '50px', height: '5px', backgroundColor: '#ECE9E4', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ width: `${calculateDynamicProjectProgress(p, projTasks)}%`, height: '100%', backgroundColor: calculateDynamicProjectProgress(p, projTasks) === 100 ? '#2E7D4E' : '#C75B39' }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#8A857D' }}>{calculateDynamicProjectProgress(p, projTasks)}%</span>
                      </div>

                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11.5px' }} onClick={() => { setSelectedProject(p); setIsDetailModalOpen(true); }}>
                          Details
                        </button>
                        <button className="action-icon-btn" onClick={() => handleOpenEditModal(p)} title="Edit Project">
                          <Edit3 size={14} />
                        </button>
                        {isDirectorOrAdmin && (
                          <button className="action-icon-btn delete-btn" onClick={() => setDeletingProjectId(p._id)} title="Delete Project">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* CREATE PROJECT MODAL (Streamlined: No budget, Optional dates, Architect, Inline +Add Client) */}
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
            placeholder="e.g. Skyline Residency 3D Architectural Renderings"
            value={newProject.projectName}
            onChange={(e) => setNewProject({ ...newProject, projectName: e.target.value })}
            error={formErrors.projectName}
            required
          />

          <FormField
            label="Client"
            labelRight={
              <span
                onClick={() => {
                  setQuickClientReturnTarget('create');
                  setIsCreateModalOpen(false);
                  setQuickClientData({ companyName: '', clientName: '', email: '', phone: '', address: '', industry: 'Real Estate & Infrastructure' });
                  setQuickClientErrors({});
                  setIsQuickAddClientOpen(true);
                }}
                style={{
                  fontSize: '11.5px',
                  color: '#C75B39',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                + Add Client
              </span>
            }
            name="client"
            type="select"
            value={newProject.client}
            onChange={(e) => {
              const selectedClientId = e.target.value;
              const selectedClientObj = clientsList.find(c => String(c._id || c.id) === String(selectedClientId));
              const autoCategory = getCategoryForClient(selectedClientObj, enquiriesList, CATEGORIES);
              setNewProject(prev => ({
                ...prev,
                client: selectedClientId,
                projectCategory: autoCategory
              }));
            }}
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
            label="Architect (Optional)"
            name="architect"
            placeholder="e.g. Ar. Sanjay Puri / Studio Lotus"
            value={newProject.architect}
            onChange={(e) => setNewProject({ ...newProject, architect: e.target.value })}
          />

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
            label="Production Manager (PM)"
            name="productionManager"
            type="select"
            value={newProject.productionManager}
            onChange={(e) => setNewProject({ ...newProject, productionManager: e.target.value })}
            error={formErrors.productionManager}
            required
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField
              label="Start Date (Optional)"
              name="startDate"
              type="date"
              value={newProject.startDate}
              onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
              error={formErrors.startDate}
            />
            <FormField
              label="End Date (Optional)"
              name="endDate"
              type="date"
              value={newProject.endDate}
              onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
              error={formErrors.endDate}
            />
          </div>

          <FormField
            label="Priority"
            name="priority"
            type="select"
            value={newProject.priority}
            onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })}
          >
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </FormField>

          <FormField
            label="Scope / Sub-Type (Optional)"
            name="projectSubType"
            placeholder="e.g. 4 Exterior Renderings + 1 Animation Video"
            value={newProject.projectSubType}
            onChange={(e) => setNewProject({ ...newProject, projectSubType: e.target.value })}
          />
        </form>
      </Modal>

      {/* EDIT PROJECT MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={resetEditProjectForm}
        title="Edit Project Details"
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
            placeholder="e.g. Skyline Residency"
            value={newProject.projectName}
            onChange={(e) => setNewProject({ ...newProject, projectName: e.target.value })}
            error={formErrors.projectName}
            required
          />

          <FormField
            label="Client"
            labelRight={
              <span
                onClick={() => {
                  setQuickClientReturnTarget('edit');
                  setIsEditModalOpen(false);
                  setQuickClientData({ companyName: '', clientName: '', email: '', phone: '', address: '', industry: 'Real Estate & Infrastructure' });
                  setQuickClientErrors({});
                  setIsQuickAddClientOpen(true);
                }}
                style={{
                  fontSize: '11.5px',
                  color: '#C75B39',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                + Add Client
              </span>
            }
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
            label="Architect (Optional)"
            name="architect"
            placeholder="e.g. Ar. Sanjay Puri"
            value={newProject.architect}
            onChange={(e) => setNewProject({ ...newProject, architect: e.target.value })}
          />

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
            label="Production Manager (PM)"
            name="productionManager"
            type="select"
            value={newProject.productionManager}
            onChange={(e) => setNewProject({ ...newProject, productionManager: e.target.value })}
            error={formErrors.productionManager}
            required
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <FormField
              label="Start Date (Optional)"
              name="startDate"
              type="date"
              value={newProject.startDate}
              onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
              error={formErrors.startDate}
            />
            <FormField
              label="End Date (Optional)"
              name="endDate"
              type="date"
              value={newProject.endDate}
              onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })}
              error={formErrors.endDate}
            />
          </div>

          <FormField
            label="Project Status"
            name="status"
            type="select"
            value={newProject.status}
            onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
          >
            {PROJECT_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
          </FormField>
        </form>
      </Modal>

      {/* PROJECT DETAILS MODAL */}
      {selectedProject && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => { setIsDetailModalOpen(false); setSelectedProject(null); }}
          title={`Project: ${selectedProject.projectName}`}
          footer={
            <button className="btn btn-secondary" onClick={() => { setIsDetailModalOpen(false); setSelectedProject(null); }}>
              Close
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Unified 4-Metric Grid (No budget) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#FAF9F7', border: '1px solid #ECE9E4' }}>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: '#8A857D', textTransform: 'uppercase', marginBottom: '4px' }}>PROGRESS</div>
                <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#1C1A17' }}>{selectedProject.progressPercentage || 0}%</div>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#FAF9F7', border: '1px solid #ECE9E4' }}>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: '#8A857D', textTransform: 'uppercase', marginBottom: '4px' }}>PRIORITY</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: selectedProject.priority === 'High' ? '#C75B39' : '#1C1A17' }}>{selectedProject.priority || 'Medium'}</div>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#FAF9F7', border: '1px solid #ECE9E4' }}>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: '#8A857D', textTransform: 'uppercase', marginBottom: '4px' }}>ARCHITECT</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1C1A17' }}>{selectedProject.architect || 'Not specified'}</div>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#FAF9F7', border: '1px solid #ECE9E4' }}>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: '#8A857D', textTransform: 'uppercase', marginBottom: '4px' }}>TIMELINE</div>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#1C1A17' }}>
                  {getProjectTimelineEstimate(selectedProject, tasksList.filter(t => (t.project?._id || t.project)?.toString() === selectedProject._id.toString())).text}
                </div>
              </div>
            </div>

            {/* Scope / Subtype if present */}
            {selectedProject.projectSubType && (
              <div style={{ padding: '10px 14px', background: '#FAF9F7', borderRadius: '8px', border: '1px solid #ECE9E4', fontSize: '12.5px', color: '#1C1A17' }}>
                <strong style={{ color: '#8A857D' }}>Deliverable Scope:</strong> {selectedProject.projectSubType}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* QUICK INLINE ADD CLIENT MODAL */}
      <Modal
        isOpen={isQuickAddClientOpen}
        onClose={handleCancelQuickClient}
        title="Add New Client"
        footer={
          <>
            <button className="btn btn-secondary" onClick={handleCancelQuickClient} disabled={quickClientSubmitting}>
              Back to Project
            </button>
            <button className="btn btn-primary" onClick={handleQuickCreateClient} disabled={quickClientSubmitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              {quickClientSubmitting ? <><Loader2 className="animate-spin" size={14} /> Saving...</> : 'Save & Select Client'}
            </button>
          </>
        }
      >
        <form onSubmit={handleQuickCreateClient} noValidate>
          <FormField
            label="Company / Entity Name"
            name="companyName"
            placeholder="e.g. Acme Realty Developers"
            value={quickClientData.companyName}
            onChange={(e) => setQuickClientData({ ...quickClientData, companyName: e.target.value })}
            error={quickClientErrors.companyName}
            required
          />

          <FormField
            label="Contact Person Name"
            name="clientName"
            placeholder="e.g. John Doe"
            value={quickClientData.clientName}
            onChange={(e) => setQuickClientData({ ...quickClientData, clientName: e.target.value })}
            error={quickClientErrors.clientName}
            required
          />

          <FormField
            label="Email Address"
            name="email"
            type="email"
            placeholder="e.g. contact@acme.com"
            value={quickClientData.email}
            onChange={(e) => setQuickClientData({ ...quickClientData, email: e.target.value })}
            error={quickClientErrors.email}
          />

          <FormField
            label="Phone Number"
            name="phone"
            type="tel"
            placeholder="e.g. +91 98765 43210"
            value={quickClientData.phone}
            onChange={(e) => setQuickClientData({ ...quickClientData, phone: e.target.value })}
          />

          <FormField
            label="Industry Domain"
            name="industry"
            placeholder="e.g. Real Estate & Infrastructure"
            value={quickClientData.industry}
            onChange={(e) => setQuickClientData({ ...quickClientData, industry: e.target.value })}
          />

          <FormField
            label="Billing / Office Address"
            name="address"
            type="textarea"
            placeholder="e.g. Suite 400, Commerce Tower..."
            value={quickClientData.address}
            onChange={(e) => setQuickClientData({ ...quickClientData, address: e.target.value })}
          />
        </form>
      </Modal>

      {/* DELETE PROJECT CONFIRMATION MODAL */}
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
        <p style={{ fontSize: '0.9rem', color: '#1C1A17' }}>
          Are you sure you want to delete this project? It will be marked as deleted.
        </p>
      </Modal>

      <ClockInGuardModal />
    </div>
  );
};