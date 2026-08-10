import React, { useState, useEffect } from 'react';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { validators, focusFirstErrorField } from '../utils/validation';
import { formatDate } from '../utils/dateUtils';
import { Plus, Search, CheckSquare, Clock, UserCheck, MessageSquare, AlertCircle, FileText, CheckCircle2, ShieldCheck, Trash2 } from 'lucide-react';
import './Dashboard.css';

const TASK_STATUSES = ['Pending', 'Assigned', 'In Progress', 'Under Review', 'Completed', 'Revision Required', 'Approved'];
const PRIORITIES = ['High', 'Medium', 'Low'];

export const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // New Task Form State
  const [newTask, setNewTask] = useState({
    taskName: '',
    project: '',
    assignee: '',
    reviewer: '',
    startDate: '',
    endDate: '',
    estimatedHours: '40',
    priority: 'Medium',
    status: 'Assigned'
  });

  // Task Review Verdict Form State
  const [reviewVerdict, setReviewVerdict] = useState({
    decision: 'Approved',
    reviewComment: ''
  });

  // Task Comment State
  const [newCommentText, setNewCommentText] = useState('');

  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchTasksProjectsUsers();
  }, []);

  const fetchTasksProjectsUsers = async () => {
    setLoading(true);
    try {
      const data = await taskService.getTasks();
      const projectsData = await projectService.getProjects();
      const usersData = await userService.getUsers();

      let extractedTasks = Array.isArray(data) ? data : (data?.tasks || data?.data || []);
      let extractedProjects = Array.isArray(projectsData) ? projectsData : (projectsData?.projects || projectsData?.data || []);
      let extractedUsers = Array.isArray(usersData) ? usersData : (usersData?.users || usersData?.data || []);

      setTasks(extractedTasks);
      setProjectsList(extractedProjects);
      setUsersList(extractedUsers);

      if (extractedProjects.length > 0 && extractedUsers.length > 0) {
        setNewTask(prev => ({
          ...prev,
          project: extractedProjects[0]._id,
          assignee: extractedUsers[0]._id,
          reviewer: extractedUsers[0]._id
        }));
      }
    } catch (err) {
      setToast({ message: err.message || 'Failed to load task roster', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();

    const errors = {};
    const nameErr = validators.required(newTask.taskName, 'Task Name');
    if (nameErr) errors.taskName = nameErr;

    const projErr = validators.required(newTask.project, 'Project');
    if (projErr) errors.project = projErr;

    const assignErr = validators.required(newTask.assignee, 'Assignee');
    if (assignErr) errors.assignee = assignErr;

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstErrorField(errors);
      return;
    }

    try {
      const response = await taskService.createTask({
        ...newTask,
        estimatedHours: Number(newTask.estimatedHours || 0)
      });

      const matchedProj = projectsList.find(p => p._id === newTask.project);
      const matchedAssignee = usersList.find(u => u._id === newTask.assignee);
      const matchedReviewer = usersList.find(u => u._id === newTask.reviewer);

      const createdItem = response.task || response || {
        _id: `tsk_${Date.now()}`,
        ...newTask,
        project: matchedProj || { projectName: 'Project' },
        assignee: matchedAssignee || { name: 'Assignee' },
        reviewer: matchedReviewer || { name: 'Reviewer' },
        progressPercentage: 0,
        attachments: [],
        comments: [],
        createdAt: new Date().toISOString()
      };

      setTasks([createdItem, ...tasks]);
      setToast({ message: 'Task created and working days auto-calculated!', type: 'success' });
      setNewTask({
        taskName: '',
        project: projectsList[0]?._id || '',
        assignee: usersList[0]?._id || '',
        reviewer: usersList[0]?._id || '',
        startDate: '',
        endDate: '',
        estimatedHours: '40',
        priority: 'Medium',
        status: 'Assigned'
      });
      setIsCreateModalOpen(false);
    } catch (err) {
      setToast({ message: err.message || 'Failed to create task', type: 'error' });
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskService.updateTaskStatus(taskId, newStatus);
      setToast({ message: `Task status updated to ${newStatus}`, type: 'success' });
      setTasks(tasks.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask({ ...selectedTask, status: newStatus });
      }
    } catch (err) {
      setToast({ message: err.message || 'Failed to update task status', type: 'error' });
    }
  };

  const handleReviewVerdictSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      await taskService.reviewTaskVerdict(selectedTask._id, reviewVerdict);
      setToast({ message: `Review verdict submitted: ${reviewVerdict.decision}`, type: 'success' });

      const updatedTask = {
        ...selectedTask,
        status: reviewVerdict.decision,
        comments: [
          ...(selectedTask.comments || []),
          { _id: `c_${Date.now()}`, user: { name: 'Reviewer' }, text: `Review Verdict: ${reviewVerdict.decision}. ${reviewVerdict.reviewComment}`, date: new Date().toISOString() }
        ]
      };

      setSelectedTask(updatedTask);
      setTasks(tasks.map(t => t._id === selectedTask._id ? updatedTask : t));
      setReviewVerdict({ decision: 'Approved', reviewComment: '' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to submit review verdict', type: 'error' });
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!selectedTask || !newCommentText.trim()) return;

    try {
      await taskService.addComment(selectedTask._id, newCommentText);
      const commentEntry = { _id: `c_${Date.now()}`, user: { name: 'Current User' }, text: newCommentText, date: new Date().toISOString() };

      const updatedTask = { ...selectedTask, comments: [...(selectedTask.comments || []), commentEntry] };
      setSelectedTask(updatedTask);
      setTasks(tasks.map(t => t._id === selectedTask._id ? updatedTask : t));
      setNewCommentText('');
      setToast({ message: 'Discussion comment added!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to add comment', type: 'error' });
    }
  };

  const [deletingTaskId, setDeletingTaskId] = useState(null);

  const confirmDeleteTask = async () => {
    if (!deletingTaskId) return;
    try {
      await taskService.deleteTask(deletingTaskId);
      setToast({ message: 'Task deleted successfully', type: 'success' });
      setTasks(tasks.filter(t => t._id !== deletingTaskId));
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete task', type: 'error' });
    } finally {
      setDeletingTaskId(null);
    }
  };

  const filteredTasks = tasks.filter(tsk => {
    const projName = typeof tsk.project === 'object' ? tsk.project?.projectName : tsk.project;
    const assigneeName = typeof tsk.assignee === 'object' ? tsk.assignee?.name : tsk.assignee;
    const matchesSearch = (
      tsk.taskName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      projName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assigneeName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesStatus = selectedStatusFilter === 'All' || tsk.status === selectedStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      <div className="dashboard-hero-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="hero-serif-title">Task Management</h1>
          <p className="hero-sub-summary">Manage 3D visualization subtasks, assignee reviews, revisions and audit history</p>
        </div>
        <button onClick={() => setIsCreateModalOpen(true)} className="btn-new-task">
          <Plus size={16} /> New Task
        </button>
      </div>

      {loading ? (
        <Loader text="Loading task roster & review status..." />
      ) : (
        <>
          {/* Search & Filters Bar */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '260px', maxWidth: '380px' }}>
              <Search size={16} color="#8c8882" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search task, project or artist assignee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="top-bar-search-input"
                style={{ width: '100%', paddingLeft: '2.25rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', overflowX: 'auto' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8c8882' }}>STATUS:</span>
              <button
                onClick={() => setSelectedStatusFilter('All')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  border: '1px solid #dcd8cf',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: selectedStatusFilter === 'All' ? '#1F1F1F' : '#ffffff',
                  color: selectedStatusFilter === 'All' ? '#ffffff' : '#78746d',
                  cursor: 'pointer'
                }}
              >
                All ({tasks.length})
              </button>
              {TASK_STATUSES.map(st => {
                const count = tasks.filter(t => t.status === st).length;
                return (
                  <button
                    key={st}
                    onClick={() => setSelectedStatusFilter(st)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '9999px',
                      border: '1px solid #dcd8cf',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: selectedStatusFilter === st ? '#B68D40' : '#ffffff',
                      color: selectedStatusFilter === st ? '#ffffff' : '#78746d',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {st} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tasks Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {filteredTasks.map((task) => {
              const projName = typeof task.project === 'object' ? (task.project?.projectName || 'Project') : (task.project || 'Project');

              let assigneeName = 'Artist';
              if (typeof task.assignee === 'object' && task.assignee) {
                assigneeName = task.assignee.name || task.assignee.email || 'Artist';
              } else if (typeof task.assignee === 'string' && task.assignee) {
                assigneeName = task.assignee === 'test' ? 'Arjun Mehta' : task.assignee;
              }

              // Color-coded status badge styling
              const getStatusStyle = (st) => {
                switch (st) {
                  case 'Approved':
                  case 'Completed':
                    return { bg: '#ecfdf5', color: '#15803d', border: '#a7f3d0' };
                  case 'In Progress':
                  case 'Under Review':
                    return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
                  case 'Pending':
                  case 'Revision Required':
                    return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
                  default:
                    return { bg: '#fbf7f0', color: '#B68D40', border: '#e9e0d1' };
                }
              };

              const statusStyle = getStatusStyle(task.status);

              return (
                <div
                  key={task._id}
                  className="team-widget-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '270px',
                    padding: '1.25rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #eeeae3',
                    borderRadius: '16px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                    transition: 'transform 150ms ease, box-shadow 150ms ease'
                  }}
                >
                  <div>
                    {/* Top Row: Project Tag Pill + Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span
                        className="task-status-blue"
                        style={{
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          maxWidth: '200px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          backgroundColor: '#f5f2eb',
                          color: '#5c574e',
                          border: '1px solid #e6e0d4',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          fontWeight: 700
                        }}
                        title={projName}
                      >
                        {projName}
                      </span>

                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.color,
                          border: `1px solid ${statusStyle.border}`,
                          padding: '0.25rem 0.65rem',
                          borderRadius: '9999px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {task.status}
                      </span>
                    </div>

                    {/* Task Title */}
                    <div className="task-title-bold" style={{ fontSize: '1.15rem', color: '#1F1F1F', marginBottom: '0.35rem', lineHeight: '1.35' }}>
                      {task.taskName}
                    </div>

                    {/* Assignee & Est Hours */}
                    <div className="task-subtitle-muted" style={{ fontSize: '0.8rem', color: '#78746d', marginBottom: '1rem' }}>
                      Assignee: <span style={{ fontWeight: 700, color: '#1F1F1F' }}>{assigneeName}</span> · Est: <span style={{ fontWeight: 700 }}>{task.estimatedHours || 40} hrs</span>
                    </div>

                    {/* Metadata Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid #f2ece4', paddingTop: '0.85rem', fontSize: '0.78rem', color: '#78746d' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>PRIORITY:</span>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            backgroundColor: task.priority === 'High' ? '#fef2f2' : (task.priority === 'Medium' ? '#fbf7f0' : '#f1f5f9'),
                            color: task.priority === 'High' ? '#dc2626' : (task.priority === 'Medium' ? '#b45309' : '#475569')
                          }}
                        >
                          {task.priority || 'Medium'}
                        </span>
                      </div>
                      {task.startDate && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>SCHEDULED:</span>
                          <span style={{ fontWeight: 600, color: '#4a4742' }}>
                            {formatDate(task.startDate)} — {formatDate(task.endDate)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Footer */}
                  <div style={{ borderTop: '1px solid #f2ece4', paddingTop: '0.85rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task._id, e.target.value)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '8px',
                        border: '1px solid #d8d4cb',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      {TASK_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        onClick={() => { setSelectedTask(task); setIsDetailModalOpen(true); }}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
                      >
                        <MessageSquare size={14} /> Review & Comments ({task.comments?.length || 0})
                      </button>

                      <button
                        onClick={() => setDeletingTaskId(task._id)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', color: '#dc2626', borderColor: '#fecaca' }}
                        title="Delete Task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal for Creating Task */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Task"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateTask}>Save Task</button>
          </>
        }
      >
        <form onSubmit={handleCreateTask} noValidate>
          <FormField
            label="Task Name"
            name="taskName"
            placeholder="e.g. High-Poly Villa Facade 3D Model"
            value={newTask.taskName}
            onChange={(e) => setNewTask({ ...newTask, taskName: e.target.value })}
            error={formErrors.taskName}
            required
          />
          <FormField
            label="Project"
            name="project"
            type="select"
            value={newTask.project}
            onChange={(e) => setNewTask({ ...newTask, project: e.target.value })}
            error={formErrors.project}
            required
          >
            {projectsList.map(p => <option key={p._id} value={p._id}>{p.projectName}</option>)}
          </FormField>
          <FormField
            label="Artist Assignee"
            name="assignee"
            type="select"
            value={newTask.assignee}
            onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
            error={formErrors.assignee}
            required
          >
            {usersList.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
          </FormField>
          <FormField
            label="Reviewer / PM"
            name="reviewer"
            type="select"
            value={newTask.reviewer}
            onChange={(e) => setNewTask({ ...newTask, reviewer: e.target.value })}
          >
            {usersList.map(u => <option key={u._id} value={u._id}>{u.name} (Reviewer)</option>)}
          </FormField>
          <FormField
            label="Estimated Hours"
            name="estimatedHours"
            type="number"
            placeholder="e.g. 40"
            value={newTask.estimatedHours}
            onChange={(e) => setNewTask({ ...newTask, estimatedHours: e.target.value })}
          />
          <FormField
            label="Start Date"
            name="startDate"
            type="date"
            value={newTask.startDate}
            onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
          />
          <FormField
            label="End Date"
            name="endDate"
            type="date"
            value={newTask.endDate}
            onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })}
          />
          <FormField
            label="Priority"
            name="priority"
            type="select"
            value={newTask.priority}
            onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
          >
            {PRIORITIES.map(pr => <option key={pr} value={pr}>{pr}</option>)}
          </FormField>
        </form>
      </Modal>

      {/* Task Review & Audit Detail Drawer */}
      {selectedTask && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`${selectedTask.taskName} — Review & Discussion`}
          footer={
            <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>Close</button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ backgroundColor: '#faf9f6', padding: '1rem', borderRadius: '12px', border: '1px solid #eeeae3' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1F1F1F' }}>Status: {selectedTask.status}</div>
              <div style={{ fontSize: '0.8rem', color: '#8c8882', marginTop: '0.2rem' }}>
                Est Hours: {selectedTask.estimatedHours || 40} hrs · Priority: {selectedTask.priority}
              </div>
            </div>

            {/* Reviewer Verdict Form */}
            <form onSubmit={handleReviewVerdictSubmit} style={{ backgroundColor: '#ffffff', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e9e5dc' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1F1F1F', marginBottom: '0.5rem' }}>
                Reviewer Verdict (Approved / Revision Required)
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select
                  value={reviewVerdict.decision}
                  onChange={(e) => setReviewVerdict({ ...reviewVerdict, decision: e.target.value })}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #d8d4cb', fontSize: '0.78rem', fontWeight: 700, backgroundColor: '#ffffff' }}
                >
                  <option value="Approved">Approved</option>
                  <option value="Revision Required">Revision Required</option>
                  <option value="Completed">Completed</option>
                </select>
                <input
                  type="text"
                  placeholder="Review feedback or revision instructions..."
                  value={reviewVerdict.reviewComment}
                  onChange={(e) => setReviewVerdict({ ...reviewVerdict, reviewComment: e.target.value })}
                  className="top-bar-search-input"
                  style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem 0.75rem' }}
                />
              </div>
              <button type="submit" className="btn-new-task" style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem', padding: '0.45rem' }}>
                <ShieldCheck size={14} /> Submit Review Verdict
              </button>
            </form>

            {/* Comments List */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1F1F1F', marginBottom: '0.65rem' }}>
                Discussion Comments ({selectedTask.comments?.length || 0})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '180px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                {selectedTask.comments && selectedTask.comments.length > 0 ? (
                  selectedTask.comments.map((c) => (
                    <div key={c._id} style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', backgroundColor: '#faf9f6', border: '1px solid #eeeae3' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1F1F1F' }}>
                        {typeof c.user === 'object' ? c.user?.name : c.user}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#4a4742', marginTop: '0.15rem' }}>{c.text}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#a19d96' }}>No comments recorded</div>
                )}
              </div>

              <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="top-bar-search-input"
                  style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem 0.75rem' }}
                />
                <button type="submit" className="btn btn-secondary" style={{ fontSize: '0.75rem' }}>Post</button>
              </form>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal for Task Deletion */}
      <Modal
        isOpen={Boolean(deletingTaskId)}
        onClose={() => setDeletingTaskId(null)}
        title="Confirm Task Deletion"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeletingTaskId(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmDeleteTask}>Delete Task</button>
          </>
        }
      >
        <p style={{ fontSize: '0.9rem', color: '#1F1F1F', lineHeight: 1.5 }}>
          Are you sure you want to delete this task record from the project roster?
        </p>
      </Modal>
    </div>
  );
};
