import React, { useState, useEffect, useMemo } from 'react';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';
import { userService } from '../services/userService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { formatDate } from '../utils/dateUtils';
import { 
  GitFork, CheckCircle2, Circle, Clock, Lock, Plus, ChevronRight, 
  Search, FolderKanban, Layers, User, Calendar, Check, ArrowLeft,
  ShieldCheck, AlertCircle, X, Compass, FileText, ArrowUpRight,
  TrendingUp, BarChart2, CheckSquare, Trash2
} from 'lucide-react';
import './Dashboard.css';

const DEFAULT_STAGES = {
  'Architecture': [
    'Stage 1 — Scene Prep & 3D Modelling',
    'Stage 2 — Materiality, Shading & Lighting',
    'Stage 3 — Final Rendering & Post-Production'
  ],
  'Interior Design': [
    'Stage 1 — Space Planning & Modelling',
    'Stage 2 — Materiality & Lighting',
    'Stage 3 — Post-Production'
  ],
  'Animation': [
    'Stage 1 — Storyboard & Camera Animation',
    'Stage 2 — Lighting, Shading & FX',
    'Stage 3 — Compositing & Sound Mix'
  ]
};

const ARTIST_PALETTE = {
  AM: { bg: '#EBF3FC', color: '#2563EB' },
  DP: { bg: '#FDF0E9', color: '#C75B39' },
  SQ: { bg: '#EAF5EE', color: '#2E7D4E' },
  TN: { bg: '#F5EBF7', color: '#7C3AED' },
  SP: { bg: '#FEF3EB', color: '#D97706' },
  PM: { bg: '#FAF9F7', color: '#1C1A17' }
};


// Dynamic Traffic Light Line Colors: Completed = Green, In Progress = Yellow, Remaining = Red
const getTrafficLineColor = (progress, status) => {
  if (progress === 100 || status === 'Completed') return '#2E7D4E'; // Green
  if (progress > 0 || status === 'In Progress' || status === 'Under Review') return '#EAB308'; // Yellow
  return '#EF4444'; // Red (Baki / Not Started)
};

export const ProjectInfo = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null); // null = list view; object = workflow tree
  const [tasksList, setTasksList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Custom added subdivisions per project (in addition to standard stages)
  const [customSubdivisions, setCustomSubdivisions] = useState({});
  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState(false);
  const [newSubdivision, setNewSubdivision] = useState({
    name: '',
    phase: 'Stage 1 — 3D Modelling',
    progress: 0,
    status: 'In Progress'
  });

  // Drawer / Detail Modal for selected workflow stage card
  const [activeWorkflowCard, setActiveWorkflowCard] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Quick Task Addition inside Drawer
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [projs, tasks, users] = await Promise.all([
        projectService.getProjects(),
        taskService.getTasks(),
        userService.getUsers()
      ]);

      const validProjs = Array.isArray(projs) ? projs : (projs.projects || []);
      const activeProjs = validProjs.filter(p => !p.isDeleted);
      setProjects(activeProjs);
      setTasksList(Array.isArray(tasks) ? tasks : (tasks.tasks || []));
      setUsersList(Array.isArray(users) ? users : (users.users || []));
    } catch (err) {
      console.error('Error loading project info data:', err);
      setToast({ message: 'Failed to load projects roster', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Filtered projects for the list view
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const clientName = typeof p.client === 'object' ? (p.client?.companyName || p.client?.clientName) : '';
      const pmName = typeof p.productionManager === 'object' ? p.productionManager?.name : '';
      const matchSearch = !searchQuery ||
        p.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pmName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.architect?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory = selectedCategory === 'All' || p.projectCategory === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [projects, searchQuery, selectedCategory]);

  const currentProjectTasks = useMemo(() => {
    if (!selectedProject) return [];
    return tasksList.filter(t => {
      const tProjId = typeof t.project === 'object' ? t.project?._id?.toString() : t.project?.toString();
      return tProjId === selectedProject._id?.toString();
    });
  }, [selectedProject, tasksList]);

  // Derive 100% dynamic stages & workflow nodes for the selected project
  const currentWorkflowStages = useMemo(() => {
    if (!selectedProject) return [];
    const pId = selectedProject._id;
    const cat = selectedProject.projectCategory || 'Architecture';
    const standardStageNames = DEFAULT_STAGES[cat] || DEFAULT_STAGES['Architecture'];

    // Map tasks to stages
    return standardStageNames.map((stageName, idx) => {
      const stageTasks = currentProjectTasks.filter(t => {
        let tStageStr = '';
        if (typeof t.stage === 'string') tStageStr = t.stage.toLowerCase();
        else if (typeof t.stage === 'object' && t.stage !== null) tStageStr = (t.stage.name || t.stage.title || t.stage._id || '').toString().toLowerCase();
        else if (t.stage !== undefined && t.stage !== null) tStageStr = String(t.stage).toLowerCase();

        const tTitleStr = (t.title || '').toString().toLowerCase();
        const num = idx + 1;
        return tStageStr.includes(`stage ${num}`) || 
               tStageStr.includes(`stage-${num}`) || 
               tTitleStr.includes(`stage ${num}`) || 
               (idx === 0 && (!t.stage || tStageStr === 'default' || tStageStr === ''));
      });

      const totalTasks = stageTasks.length;
      let stageProgress = 0;
      if (selectedProject.status === 'Completed') {
        stageProgress = 100;
      } else if (totalTasks > 0) {
        let score = 0;
        stageTasks.forEach(t => {
          if (t.status === 'Completed' || t.status === 'Done') score += 100;
          else if (t.status === 'In Progress' || t.status === 'Under Review') score += 50;
        });
        stageProgress = Math.min(100, Math.round(score / totalTasks));
      } else if (selectedProject.status === 'In Progress' && idx === 0) {
        stageProgress = 15;
      }

      return {
        id: `stage_${idx}_${pId}`,
        stageIndex: idx + 1,
        name: stageName,
        phase: `Stage ${idx + 1} Workflow`,
        progress: stageProgress,
        status: stageProgress === 100 ? 'Completed' : (stageProgress > 0 ? 'In Progress' : 'Not Started'),
        tasksCount: totalTasks,
        doneCount: stageTasks.filter(t => t.status === 'Completed' || t.status === 'Done').length,
        tasks: stageTasks
      };
    });
  }, [selectedProject, currentProjectTasks]);

  // Combined workflow nodes (Stages + Any custom subdivisions added)
  const allWorkflowNodes = useMemo(() => {
    if (!selectedProject) return [];
    const pId = selectedProject._id;
    const custom = customSubdivisions[pId] || [];
    return [...currentWorkflowStages, ...custom];
  }, [selectedProject, currentWorkflowStages, customSubdivisions]);

  // Check if all stages are 100% completed
  const isAllStagesCompleted = useMemo(() => {
    if (!selectedProject) return false;
    if (selectedProject.status === 'Completed') return true;
    if (allWorkflowNodes.length === 0) return false;
    return allWorkflowNodes.every(s => s.progress === 100 || s.status === 'Completed');
  }, [allWorkflowNodes, selectedProject]);

  // Overall workflow progress
  const overallWorkflowProgress = useMemo(() => {
    if (!selectedProject) return 0;
    if (selectedProject.status === 'Completed') return 100;
    if (allWorkflowNodes.length === 0) return selectedProject.progressPercentage || 0;
    const sum = allWorkflowNodes.reduce((acc, curr) => acc + curr.progress, 0);
    return Math.min(100, Math.round(sum / allWorkflowNodes.length));
  }, [selectedProject, allWorkflowNodes]);

  // Handle Add Custom Subdivision
  const handleAddSubdivision = (e) => {
    if (e) e.preventDefault();
    if (!newSubdivision.name.trim()) {
      setToast({ message: 'Subdivision name is required', type: 'error' });
      return;
    }

    const pId = selectedProject._id;
    const newSubItem = {
      id: `sub_${Date.now()}_${pId}`,
      name: newSubdivision.name.trim(),
      phase: newSubdivision.phase || 'Custom Deliverable',
      progress: Number(newSubdivision.progress) || 0,
      status: Number(newSubdivision.progress) === 100 ? 'Completed' : 'In Progress',
      tasksCount: 0,
      doneCount: 0,
      tasks: []
    };

    setCustomSubdivisions(prev => ({
      ...prev,
      [pId]: [...(prev[pId] || []), newSubItem]
    }));

    setIsAddSubModalOpen(false);
    setNewSubdivision({ name: '', phase: 'Stage 1 — 3D Modelling', progress: 0, status: 'In Progress' });
    setToast({ message: `Subdivision "${newSubItem.name}" added to workflow tree!`, type: 'success' });
  };

  // Quick Task Status Toggle inside Details Modal
  const handleToggleTaskStatus = async (task) => {
    const nextStatus = (task.status === 'Done' || task.status === 'Completed') ? 'In Progress' : 'Done';
    try {
      await taskService.updateTask(task._id, { status: nextStatus });
      const updatedTasks = await taskService.getTasks();
      const valid = Array.isArray(updatedTasks) ? updatedTasks : (updatedTasks.tasks || []);
      setTasksList(valid);

      // Update active card's tasks
      if (activeWorkflowCard) {
        const refreshedTasks = valid.filter(t => {
          const tProjId = typeof t.project === 'object' ? t.project?._id?.toString() : t.project?.toString();
          return tProjId === selectedProject._id?.toString() && (activeWorkflowCard.tasks?.some(at => at._id === t._id));
        });
        setActiveWorkflowCard(prev => ({ ...prev, tasks: refreshedTasks }));
      }
      setToast({ message: `Task marked as ${nextStatus}`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to update task status', type: 'error' });
    }
  };

  // Add Task to Stage inside Details Modal
  const handleAddTaskToStage = async () => {
    if (!newTaskTitle.trim()) {
      setToast({ message: 'Task title is required', type: 'error' });
      return;
    }

    try {
      const stageName = activeWorkflowCard?.name || 'Stage 1';
      const created = await taskService.createTask({
        title: newTaskTitle.trim(),
        project: selectedProject._id,
        stage: stageName,
        assignedTo: newTaskAssignee || undefined,
        status: 'In Progress',
        priority: 'Medium',
        startDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      });

      const updatedTasks = await taskService.getTasks();
      const valid = Array.isArray(updatedTasks) ? updatedTasks : (updatedTasks.tasks || []);
      setTasksList(valid);

      setNewTaskTitle('');
      setNewTaskAssignee('');
      setToast({ message: `Task added to ${stageName}!`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to create task', type: 'error' });
    }
  };

  return (
    <div className="dashboard-layout-content smooth-fade-in" style={{ padding: '1.25rem 2rem' }}>
      {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />}

      {loading ? (
        <Loader text="Loading Project Info & Workflow Hub..." />
      ) : !selectedProject ? (
        /* =========================================================================
           LEVEL 1: PROJECT LIST & ROSTER VIEW
           ========================================================================= */
        <div>
          {/* Header Bar */}
          <div className="page-header-responsive" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '1.25rem' }}>
            <div>
              <h1 className="hero-serif-title">Project Info</h1>
              <p className="hero-sub-summary">Select any project to explore its interactive visual workflow tree, stage progression, and tasks</p>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
              <Search size={16} color="#8A857D" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search projects by name, client, architect, PM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="top-bar-search-input"
                style={{ width: '100%', paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          {/* Category Pill Filters */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {['All', 'Architecture', 'Interior Design', 'Animation'].map(cat => {
              const isSelected = selectedCategory === cat;
              const label = cat === 'All' ? 'All projects' : (cat === 'Architecture' ? 'Architecture / RE' : cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    border: isSelected ? '1px solid #1C1A17' : '1px solid #ECE9E4',
                    cursor: 'pointer',
                    padding: '6px 16px',
                    borderRadius: '99px',
                    fontSize: '12px',
                    fontWeight: 500,
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

          {/* Projects Grid Cards */}
          {filteredProjects.length === 0 ? (
            <div style={{ padding: '3.5rem 2rem', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #ECE9E4', color: '#8A857D' }}>
              No projects found matching your search.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {filteredProjects.map(proj => {
                const clientName = typeof proj.client === 'object' ? (proj.client?.companyName || proj.client?.clientName) : 'Client';
                const pmName = typeof proj.productionManager === 'object' ? proj.productionManager?.name : 'PM';
                const pTasks = tasksList.filter(t => {
                  const tProjId = typeof t.project === 'object' ? t.project?._id?.toString() : t.project?.toString();
                  return tProjId === proj._id?.toString();
                });
                const doneTasks = pTasks.filter(t => t.status === 'Completed' || t.status === 'Done').length;
                const calcProg = proj.status === 'Completed' ? 100 : (pTasks.length > 0 ? Math.round((doneTasks / pTasks.length) * 100) : (proj.progressPercentage || 0));

                return (
                  <div
                    key={proj._id}
                    onClick={() => setSelectedProject(proj)}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #ECE9E4',
                      borderRadius: '14px',
                      padding: '18px 20px',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(28,26,23,0.03)',
                      transition: 'all 180ms ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(28,26,23,0.07)'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(28,26,23,0.03)'; e.currentTarget.style.borderColor = '#ECE9E4'; }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span className="micro-category-pill" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {proj.projectCategory}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          padding: '3px 8px',
                          borderRadius: '99px',
                          backgroundColor: proj.status === 'Completed' ? '#EAF5EE' : (proj.status === 'In Progress' ? '#FDF0E9' : '#FAF9F7'),
                          color: proj.status === 'Completed' ? '#2E7D4E' : (proj.status === 'In Progress' ? '#C75B39' : '#8A857D'),
                          border: '1px solid #ECE9E4'
                        }}>
                          {proj.status}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '15px', fontWeight: 500, color: '#1C1A17', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                        {proj.projectName}
                      </h3>

                      <div style={{ fontSize: '12px', color: '#8A857D', marginBottom: '14px', lineHeight: 1.4 }}>
                        {clientName} · Lead: {pmName} {proj.architect ? `· Arch: ${proj.architect}` : ''}
                      </div>
                    </div>

                    <div>
                      {/* Progress Bar in Terracotta & Green Brand Palette */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#8A857D', marginBottom: '4px' }}>
                          <span>Stage Progress</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: calcProg === 100 ? '#2E7D4E' : '#1C1A17' }}>{calcProg}%</span>
                        </div>
                        <div style={{ height: '5px', borderRadius: '99px', backgroundColor: '#F1EEE9', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '99px', backgroundColor: calcProg === 100 ? '#2E7D4E' : (calcProg > 0 ? '#C75B39' : '#ECE9E4'), width: `${calcProg}%` }} />
                        </div>
                      </div>

                      {/* CTA */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F5F2ED', paddingTop: '10px', fontSize: '12px', color: '#C75B39', fontWeight: 500 }}>
                        <span>View Project Workflow Tree</span>
                        <ArrowUpRight size={14} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* =========================================================================
           LEVEL 2: DEDICATED WORKFLOW TREE VIEW (STAGE & TASK BASED BRANCHING)
           ========================================================================= */
        <div>
          {/* Back Navigation Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setSelectedProject(null)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #ECE9E4',
                backgroundColor: '#FFFFFF',
                color: '#1C1A17',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(28,26,23,0.03)'
              }}
            >
              <ArrowLeft size={14} /> Back to All Projects
            </button>

            
          </div>

          {/* Quick Project Summary Strip */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '14px 20px', backgroundColor: '#FFFFFF', border: '1px solid #ECE9E4', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(28,26,23,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#1C1A17', color: '#FAF9F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FolderKanban size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 500, color: '#1C1A17' }}>{selectedProject.projectName}</span>
                  <span className="micro-category-pill">{selectedProject.projectCategory}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#8A857D', marginTop: '2px' }}>
                  Client: {typeof selectedProject.client === 'object' ? (selectedProject.client?.companyName || selectedProject.client?.clientName) : 'Client'} · Lead: {typeof selectedProject.productionManager === 'object' ? selectedProject.productionManager?.name : 'PM'} {selectedProject.architect ? `· Arch: ${selectedProject.architect}` : ''}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#8A857D', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Workflow Progress</div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#1C1A17', fontFamily: 'var(--font-mono)' }}>
                  {overallWorkflowProgress}%
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 500, padding: '4px 10px', borderRadius: '99px', backgroundColor: selectedProject.status === 'Completed' ? '#EAF5EE' : '#FDF0E9', color: selectedProject.status === 'Completed' ? '#2E7D4E' : '#C75B39' }}>
                {selectedProject.status}
              </span>
            </div>
          </div>

          {/* Workflow Tree Visual Card */}
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #ECE9E4', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(28,26,23,0.04)' }}>
            

            {/* Visual Connected Tree Flow Canvas */}
            <div style={{ overflowX: 'auto', padding: '20px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '940px', position: 'relative' }}>
                
                {/* 1. OVERALL START CARD (LEFT) */}
                <div 
                  onClick={() => { setActiveWorkflowCard({ type: 'start', title: '1. Project Init', desc: 'Token payment confirmed, project initialized.', status: 'Completed', details: ['Initial Scope Verification', 'Client Brief Signoff', 'Asset Library Prep'] }); setIsDetailDrawerOpen(true); }}
                  style={{
                    width: '260px',
                    flexShrink: 0,
                    backgroundColor: '#FFFFFF',
                    border: '1.5px solid #2E7D4E',
                    borderRadius: '14px',
                    padding: '18px',
                    boxShadow: '0 2px 10px rgba(46,125,78,0.08)',
                    cursor: 'pointer',
                    zIndex: 2,
                    transition: 'transform 150ms ease, box-shadow 150ms ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(46,125,78,0.12)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(46,125,78,0.08)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: '#2E7D4E', textTransform: 'uppercase' }}>
                      OVERALL START
                    </span>
                    <CheckCircle2 size={16} color="#2E7D4E" />
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: 500, color: '#1C1A17', margin: '0 0 4px 0' }}>
                    1. Project Init
                  </h3>
                  <p style={{ fontSize: '12px', color: '#8A857D', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                    Token payment confirmed, project initialized.
                  </p>

                  <div style={{ backgroundColor: '#EAF5EE', color: '#2E7D4E', padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                    <Check size={13} /> Active & Completed
                  </div>
                </div>

                {/* SVG Connecting Bridge 1 (Left Start to Stage Branches) */}
                <div style={{ width: '70px', height: `${Math.max(240, allWorkflowNodes.length * 120)}px`, flexShrink: 0, position: 'relative' }}>
                  <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {allWorkflowNodes.map((node, idx) => {
                      const count = allWorkflowNodes.length;
                      const h = Math.max(240, count * 120);
                      const yStart = h / 2;
                      const yEnd = count === 1 ? h / 2 : 45 + (idx * ((h - 90) / (count - 1)));
                      const strokeColor = getTrafficLineColor(node.progress, node.status);
                      return (
                        <path
                          key={`curve_in_${idx}`}
                          d={`M 0 ${yStart} C 35 ${yStart}, 35 ${yEnd}, 70 ${yEnd}`}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </svg>
                </div>

                {/* 2. DYNAMIC STAGES & SUBDIVISIONS BRANCHING NODES (MIDDLE) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minWidth: '320px', zIndex: 2 }}>
                  {allWorkflowNodes.map((node) => {
                    const isDone = node.progress === 100 || node.status === 'Completed';
                    const barColor = getTrafficLineColor(node.progress, node.status);

                    return (
                      <div
                        key={node.id}
                        onClick={() => { setActiveWorkflowCard(node); setIsDetailDrawerOpen(true); }}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: isDone ? '1px solid #ECE9E4' : '1.5px solid #FDF0E9',
                          borderRadius: '14px',
                          padding: '16px 20px',
                          boxShadow: '0 2px 8px rgba(28,26,23,0.04)',
                          cursor: 'pointer',
                          transition: 'transform 150ms ease, box-shadow 150ms ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(28,26,23,0.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(28,26,23,0.04)'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: '#8A857D', textTransform: 'uppercase' }}>
                            {node.stageIndex ? `STAGE ${node.stageIndex} WORKFLOW` : 'SUBDIVISION'}
                          </span>
                          {isDone ? <CheckCircle2 size={16} color="#2E7D4E" /> : <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getTrafficLineColor(node.progress, node.status) }} />}
                        </div>

                        <h3 style={{ fontSize: '15px', fontWeight: 500, color: '#1C1A17', margin: '0 0 4px 0', lineHeight: 1.3 }}>
                          {node.name}
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#55504A', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <GitFork size={13} color="#8A857D" /> 
                            <span>{node.tasksCount > 0 ? `${node.doneCount}/${node.tasksCount} Tasks Done` : 'No tasks assigned'}</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8A857D', marginBottom: '4px' }}>
                            <span>Progress</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: getTrafficLineColor(node.progress, node.status) }}>{node.progress}%</span>
                          </div>
                          <div style={{ height: '5px', borderRadius: '99px', backgroundColor: '#F1EEE9', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: '99px', backgroundColor: barColor, width: `${node.progress}%` }} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #FAF9F7', paddingTop: '8px', fontSize: '11.5px', color: '#8A857D' }}>
                          <span>View stage tasks & workflow details</span>
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* SVG Connecting Bridge 2 (Stage Branches to Right Handover) */}
                <div style={{ width: '70px', height: `${Math.max(240, allWorkflowNodes.length * 120)}px`, flexShrink: 0, position: 'relative' }}>
                  <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {allWorkflowNodes.map((node, idx) => {
                      const count = allWorkflowNodes.length;
                      const h = Math.max(240, count * 120);
                      const yStart = count === 1 ? h / 2 : 45 + (idx * ((h - 90) / (count - 1)));
                      const yEnd = h / 2;
                      const strokeColor = getTrafficLineColor(node.progress, node.status);
                      return (
                        <path
                          key={`curve_out_${idx}`}
                          d={`M 0 ${yStart} C 35 ${yStart}, 35 ${yEnd}, 70 ${yEnd}`}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </svg>
                </div>

                {/* 3. PROJECT HANDOVER CARD (RIGHT) */}
                <div 
                  onClick={() => { setActiveWorkflowCard({ type: 'handover', title: 'Project Handover', desc: 'Final client sign-off, render deliverables, and project handover.', status: isAllStagesCompleted ? 'Ready for Handover' : 'Locked until all stages finish' }); setIsDetailDrawerOpen(true); }}
                  style={{
                    width: '260px',
                    flexShrink: 0,
                    backgroundColor: isAllStagesCompleted ? '#FFFFFF' : '#FAFAFA',
                    border: isAllStagesCompleted ? '1.5px solid #2E7D4E' : '1px solid #ECE9E4',
                    borderRadius: '14px',
                    padding: '18px',
                    boxShadow: isAllStagesCompleted ? '0 2px 10px rgba(46,125,78,0.08)' : 'none',
                    cursor: 'pointer',
                    zIndex: 2,
                    transition: 'transform 150ms ease, box-shadow 150ms ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: isAllStagesCompleted ? '#2E7D4E' : '#8A857D', textTransform: 'uppercase' }}>
                      PROJECT HANDOVER
                    </span>
                    {isAllStagesCompleted ? <CheckCircle2 size={16} color="#2E7D4E" /> : <Lock size={15} color="#8A857D" />}
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: 500, color: '#1C1A17', margin: '0 0 4px 0' }}>
                    Project Handover
                  </h3>
                  <p style={{ fontSize: '12px', color: '#8A857D', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                    Customer digital sign-off and final payment (P5).
                  </p>

                  <div style={{ backgroundColor: isAllStagesCompleted ? '#EAF5EE' : '#F5F2ED', color: isAllStagesCompleted ? '#2E7D4E' : '#8A857D', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                    {isAllStagesCompleted ? (
                      <><Check size={12} /> Ready for Handover</>
                    ) : (
                      <><Lock size={12} /> Locked until all stages finish</>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD SUBDIVISION / DELIVERABLE MODAL */}
      <Modal
        isOpen={isAddSubModalOpen}
        onClose={() => setIsAddSubModalOpen(false)}
        title="Add Project Deliverable Branch / Subdivision"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAddSubModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddSubdivision}>Add to Tree</button>
          </>
        }
      >
        <form onSubmit={handleAddSubdivision} noValidate>
          <FormField
            label="Branch / Space Name"
            name="name"
            placeholder="e.g. Master Suite, Kitchen Rendering, Exterior Facade..."
            value={newSubdivision.name}
            onChange={(e) => setNewSubdivision({ ...newSubdivision, name: e.target.value })}
            required
          />

          <FormField
            label="Linked Stage"
            name="phase"
            type="select"
            value={newSubdivision.phase}
            onChange={(e) => setNewSubdivision({ ...newSubdivision, phase: e.target.value })}
          >
            <option value="Stage 1 — 3D Modelling">Stage 1 — 3D Modelling</option>
            <option value="Stage 2 — Materiality & Lighting">Stage 2 — Materiality & Lighting</option>
            <option value="Stage 3 — Post-Production">Stage 3 — Post-Production</option>
          </FormField>

          <FormField
            label="Initial Progress Percentage (%)"
            name="progress"
            type="number"
            min="0"
            max="100"
            value={newSubdivision.progress}
            onChange={(e) => setNewSubdivision({ ...newSubdivision, progress: e.target.value })}
          />
        </form>
      </Modal>

      {/* DETAIL WORKFLOW CARD & TASKS MODAL */}
      {activeWorkflowCard && (
        <Modal
          isOpen={isDetailDrawerOpen}
          onClose={() => { setIsDetailDrawerOpen(false); setActiveWorkflowCard(null); }}
          title={`Stage Details: ${activeWorkflowCard.name || activeWorkflowCard.title}`}
          footer={
            <button className="btn btn-secondary" onClick={() => { setIsDetailDrawerOpen(false); setActiveWorkflowCard(null); }}>
              Close
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '12px 16px', backgroundColor: '#FAF9F7', borderRadius: '8px', border: '1px solid #ECE9E4' }}>
              <div style={{ fontSize: '11px', color: '#8A857D', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Phase / Description</div>
              <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#1C1A17', marginTop: '2px' }}>{activeWorkflowCard.phase || activeWorkflowCard.desc || 'Active Phase'}</div>
            </div>

            {activeWorkflowCard.progress !== undefined && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8A857D', marginBottom: '4px' }}>
                  <span>Stage Completion</span>
                  <span style={{ fontWeight: 500, color: '#1C1A17', fontFamily: 'var(--font-mono)' }}>{activeWorkflowCard.progress}%</span>
                </div>
                <div style={{ height: '6px', borderRadius: '99px', backgroundColor: '#F1EEE9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '99px', backgroundColor: activeWorkflowCard.progress === 100 ? '#2E7D4E' : '#C75B39', width: `${activeWorkflowCard.progress}%` }} />
                </div>
              </div>
            )}

            {/* Stage Tasks List */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#1C1A17' }}>Stage Tasks & Deliverables:</span>
                <span style={{ fontSize: '11px', color: '#8A857D', fontFamily: 'var(--font-mono)' }}>
                  {activeWorkflowCard.tasks ? `${activeWorkflowCard.tasks.filter(t => t.status === 'Completed' || t.status === 'Done').length}/${activeWorkflowCard.tasks.length} Done` : ''}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                {activeWorkflowCard.tasks && activeWorkflowCard.tasks.length > 0 ? (
                  activeWorkflowCard.tasks.map(t => {
                    const isDone = t.status === 'Completed' || t.status === 'Done';
                    const assigneeName = typeof t.assignedTo === 'object' ? t.assignedTo?.name : 'Artist';
                    const initials = (assigneeName || 'AR').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const colorStyle = ARTIST_PALETTE[initials] || { bg: '#FAF9F7', color: '#1C1A17' };

                    return (
                      <div 
                        key={t._id} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: isDone ? '#FAF9F7' : '#FFFFFF',
                          border: '1px solid #ECE9E4'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleTaskStatus(t)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                            title="Click to toggle status"
                          >
                            {isDone ? <CheckCircle2 size={16} color="#2E7D4E" /> : <Circle size={16} color="#8A857D" />}
                          </button>
                          <span style={{ fontSize: '13px', color: isDone ? '#8A857D' : '#1C1A17', textDecoration: isDone ? 'line-through' : 'none', fontWeight: isDone ? 400 : 500 }}>
                            {t.title}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: colorStyle.bg, color: colorStyle.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9.5px', fontWeight: 600 }}>
                            {initials}
                          </div>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: '99px',
                            backgroundColor: isDone ? '#EAF5EE' : '#FDF0E9',
                            color: isDone ? '#2E7D4E' : '#C75B39'
                          }}>
                            {isDone ? 'Done' : (t.status || 'In Progress')}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#FAF9F7', borderRadius: '8px', border: '1px solid #ECE9E4', fontSize: '12px', color: '#8A857D' }}>
                    No tasks created in this stage yet. Add a task below to initiate progress.
                  </div>
                )}
              </div>

              {/* Inline Add Task to this Stage */}
              <div style={{ padding: '12px', backgroundColor: '#FAF9F7', borderRadius: '8px', border: '1px solid #ECE9E4' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 500, color: '#1C1A17', marginBottom: '8px' }}>+ Add Quick Task to this Stage:</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Task name (e.g. 3D Model Shell, Texture Mapping)..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #ECE9E4', fontSize: '12px' }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddTaskToStage(); }}
                  />
                  <select
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ECE9E4', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="">Assign Artist</option>
                    {usersList.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddTaskToStage}
                    style={{ padding: '6px 14px', borderRadius: '6px', backgroundColor: '#1C1A17', color: '#FAF9F7', border: 'none', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
