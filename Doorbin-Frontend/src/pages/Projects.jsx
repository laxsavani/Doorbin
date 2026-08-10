import React, { useState, useEffect } from 'react';
import { projectService } from '../services/projectService';
import { clientService } from '../services/clientService';
import { userService } from '../services/userService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { validators, focusFirstErrorField } from '../utils/validation';
import { formatDate } from '../utils/dateUtils';
import { Plus, Search, FolderKanban, CheckCircle2, Clock, Trash2, ShieldCheck, UserCheck, Calendar, DollarSign, Layers } from 'lucide-react';
import './Dashboard.css';

const CATEGORIES = ['Architecture', 'Interior Design', 'Animation'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const PROJECT_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Delayed'];

export const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  // Modals & Active Project Drawer
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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

  const fetchProjectsClientsUsers = async () => {
    setLoading(true);
    try {
      const data = await projectService.getProjects();
      const clientsData = await clientService.getClients();
      const usersData = await userService.getUsers();

      let extractedProjects = Array.isArray(data) ? data : (data?.projects || data?.data || []);
      let extractedClients = Array.isArray(clientsData) ? clientsData : (clientsData?.clients || clientsData?.data || []);
      let extractedUsers = Array.isArray(usersData) ? usersData : (usersData?.users || usersData?.data || []);

      setProjects(extractedProjects);
      setClientsList(extractedClients);
      setUsersList(extractedUsers);

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

    try {
      const response = await projectService.createProject({
        ...newProject,
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

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      <div className="dashboard-hero-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="hero-serif-title">Project Management & Stages</h1>
          <p className="hero-sub-summary">Manage active 3D visualization projects, stage workflows, approvals and team assignments</p>
        </div>
        <button onClick={() => setIsCreateModalOpen(true)} className="btn-new-task">
          <Plus size={16} /> New Project
        </button>
      </div>

      {loading ? (
        <Loader text="Loading active project roster & stages..." />
      ) : (
        <>
          {/* Search & Filter Bar */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '260px', maxWidth: '380px' }}>
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

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                style={{ padding: '0.45rem 0.85rem', borderRadius: '10px', border: '1px solid #dcd8cf', fontSize: '0.78rem', fontWeight: 600, backgroundColor: '#ffffff' }}
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.85rem', borderRadius: '10px', border: '1px solid #dcd8cf', fontSize: '0.78rem', fontWeight: 600, backgroundColor: '#ffffff' }}
              >
                <option value="All">All Statuses</option>
                {PROJECT_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
          </div>

          {/* Projects Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {filteredProjects.map((proj) => {
              const clientName = typeof proj.client === 'object' ? (proj.client?.companyName || proj.client?.clientName) : 'Client';
              const pmName = typeof proj.productionManager === 'object' ? (proj.productionManager?.name || 'PM') : 'PM';

              return (
                <div key={proj._id} className="team-widget-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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
                    <div className="task-subtitle-muted" style={{ marginBottom: '0.85rem' }}>
                      Client: {clientName} · PM: {pmName}
                    </div>

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

                  <div style={{ borderTop: '1px solid #f2ece4', paddingTop: '0.85rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      onClick={() => { setSelectedProject(proj); setIsDetailModalOpen(true); }}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
                    >
                      <Layers size={14} /> Workflow Stages & Approval ({proj.stages?.length || 0})
                    </button>

                    <button
                      onClick={() => setDeletingProjectId(proj._id)}
                      style={{ background: 'none', border: 'none', color: '#c7452e', cursor: 'pointer', padding: '0.35rem' }}
                      title="Delete Project"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal for Creating Project */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Visualization Project"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateProject}>Create Project</button>
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
            {usersList.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
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
          <FormField
            label="Priority Level"
            name="priority"
            type="select"
            value={newProject.priority}
            onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })}
          >
            {PRIORITIES.map(pr => <option key={pr} value={pr}>{pr}</option>)}
          </FormField>
        </form>
      </Modal>

      {/* Project Workflow Stages & Approval Drawer */}
      {selectedProject && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`${selectedProject.projectName} — Workflow Stages & Approvals`}
          footer={
            <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>Close</button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ backgroundColor: '#faf9f6', padding: '1rem', borderRadius: '12px', border: '1px solid #eeeae3' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1F1F1F' }}>Category: {selectedProject.projectCategory}</div>
              <div style={{ fontSize: '0.8rem', color: '#8c8882', marginTop: '0.2rem' }}>
                Overall Progress: {selectedProject.progressPercentage}% · Status: {selectedProject.status}
              </div>
            </div>

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
    </div>
  );
};
