import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { validators, focusFirstErrorField } from '../utils/validation';
import { authService } from '../services/authService';
import { dashboardService } from '../services/dashboardService';
import { Loader } from '../components/Loader';
import { ClockInOutWidget } from '../components/ClockInOutWidget';
import { Plus } from 'lucide-react';
import './Dashboard.css';

import { hrService } from '../services/hrService';

export const Dashboard = () => {
  // Dynamic Logged-in User Session Extraction
  const rawUser = authService.getCurrentUser();
  const userName = typeof rawUser?.name === 'string'
    ? rawUser.name
    : (rawUser?.name?.name || rawUser?.email || 'Lax Savani');

  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dynamic Dashboard Data States
  const [projectCards, setProjectCards] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // Fetch Dynamic Dashboard Data & Team Roster on Mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const data = await dashboardService.getDashboardData();
        if (data.projects) setProjectCards(data.projects);
        if (data.tasks) setTasks(data.tasks);

        const emps = await hrService.getEmployees();
        if (Array.isArray(emps) && emps.length > 0) {
          const colors = ['#495a70', '#766782', '#4d808e', '#a36c56', '#547d5e', '#8a7e53'];
          setTeamMembers(emps.map((emp, idx) => ({
            name: emp.name,
            avatar: emp.name ? emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'EM',
            bg: colors[idx % colors.length],
            status: emp.status === 'Active' ? 'Active' : 'On Leave',
            isBooked: idx % 2 === 0
          })));
        }
      } catch (err) {
        setToast({ message: 'Failed to load live dashboard data', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // New Task Form State
  const [newTask, setNewTask] = useState({
    title: '',
    project: '',
    date: '',
    assignee: 'AM'
  });
  const [formErrors, setFormErrors] = useState({});

  const handleTaskSubmit = async (e) => {
    e.preventDefault();

    const errors = {};
    const titleErr = validators.required(newTask.title, 'Task Title');
    if (titleErr) errors.title = titleErr;

    const projectErr = validators.required(newTask.project, 'Project Name');
    if (projectErr) errors.project = projectErr;

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      focusFirstErrorField(errors);
      return;
    }

    try {
      const response = await dashboardService.createTask(newTask);
      const createdTask = response.task || {
        id: Date.now(),
        title: newTask.title,
        projectStage: `${newTask.project} · Stage 1`,
        status: 'In Progress',
        statusClass: 'task-status-blue',
        date: newTask.date || 'Jul 18',
        userAvatar: newTask.assignee,
        avatarBg: '#2b74c9'
      };

      setTasks([createdTask, ...tasks]);
      setToast({ message: response.message || 'New task created successfully!', type: 'success' });
      setNewTask({ title: '', project: '', date: '', assignee: 'AM' });
      setIsTaskModalOpen(false);
    } catch (err) {
      setToast({ message: err.message || 'Failed to create task', type: 'error' });
    }
  };

  return (
    <main className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Hero Greeting Section */}
      <div className="dashboard-hero-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="hero-serif-title">
            Good morning, {userName.split(' ')[0]}
          </h1>
          <p className="hero-sub-summary">
            {tasks.length} tasks due this week · 1 overdue · Hillcrest review with Vistara on Thursday
          </p>
        </div>

        <button onClick={() => setIsTaskModalOpen(true)} className="btn-new-task">
          <Plus size={16} /> New task
        </button>
      </div>

      {loading ? (
        <Loader text="Loading dashboard metrics..." />
      ) : (
        <>
          {/* Dynamic Project Cards Grid */}
      <div className="project-cards-scroll-container">
        {projectCards.map((card) => (
          <div key={card.id} className="project-card">
            <div>
              <div className="project-card-header">
                <span className="project-category-text">{card.category}</span>
                <span className={`status-badge-pill ${card.badgeClass}`}>{card.badge}</span>
              </div>
              <div className="project-card-title">{card.title}</div>
              <div className="project-card-client">{card.client}</div>
            </div>

            <div className="project-progress-footer">
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${card.progress}%`, backgroundColor: card.barColor }}
                />
              </div>
              <span className="progress-percent-text">{card.progress}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Split Main Section (2 Columns) */}
      <div className="dashboard-split-grid">
        {/* Left Column: Needs Attention & Tasks Due This Week */}
        <div>
          {/* Needs Attention Task Card */}
          {(() => {
            const urgentTask = tasks.find(t => t.status === 'Revision Required' || t.status === 'Pending') || tasks[0];
            return (
              <>
                <div className="section-label-red">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#c7452e' }} />
                  Needs attention
                </div>

                <div className="overdue-card-item">
                  <div>
                    <div className="task-title-bold">{urgentTask?.title || 'System Status Check'}</div>
                    <div className="task-subtitle-muted">{urgentTask?.projectStage || 'All project tasks on track'}</div>
                  </div>

                  <div className="task-meta-right">
                    <span className="task-date-red">{urgentTask?.date || 'Today'}</span>
                    <div className="task-user-avatar" style={{ backgroundColor: urgentTask?.avatarBg || '#c7452e' }}>
                      {urgentTask?.userAvatar || 'PM'}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {/* Due This Week Tasks List */}
          <div className="section-label-dark">
            Due this week <span style={{ color: '#8c8882', fontWeight: 500 }}>{tasks.length} tasks</span>
          </div>

          <div className="tasks-list-container">
            {tasks.map((task) => (
              <div key={task.id} className="task-row-card">
                <div>
                  <div className="task-title-bold">
                    <span style={{ color: '#8c8882', marginRight: '6px' }}>•</span>
                    {task.title}
                  </div>
                  <div className="task-subtitle-muted" style={{ marginLeft: '14px' }}>
                    {task.projectStage}
                  </div>
                </div>

                <div className="task-meta-right">
                  <span className={task.statusClass}>{task.status}</span>
                  <span className="task-date-grey">{task.date}</span>
                  <div className="task-user-avatar" style={{ backgroundColor: task.avatarBg }}>
                    {task.userAvatar}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Attendance Shift Widget & Team This Week */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <ClockInOutWidget variant="card" />
          <div className="team-widget-card">
            <div className="team-widget-title">Team this week</div>

            {teamMembers.map((member, index) => (
              <div key={index} className="team-member-row">
                <div className="team-member-info">
                  <div className="team-avatar" style={{ backgroundColor: member.bg }}>
                    {member.avatar}
                  </div>
                  <span className="team-name">{member.name}</span>
                </div>

                <div className="team-status-indicator">
                  <span className="team-status-label">{member.status}</span>
                  <div className="team-bar-track">
                    <div className={member.isBooked ? 'team-bar-booked' : 'team-bar-partial'} />
                  </div>
                </div>
              </div>
            ))}

            <div className="team-availability-note">
              Dev frees up from Jul 27 — first slot for new-project work. See Timeline for full availability.
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Modal for Creating New Task */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Create New Task"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsTaskModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleTaskSubmit}>
              Save Task
            </button>
          </>
        }
      >
        <form onSubmit={handleTaskSubmit} noValidate>
          <FormField
            label="Task Title"
            name="title"
            placeholder="e.g. 3D Model Lighting & Render"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            error={formErrors.title}
            required
          />

          <FormField
            label="Project Name"
            name="project"
            placeholder="e.g. Hillcrest Residence"
            value={newTask.project}
            onChange={(e) => setNewTask({ ...newTask, project: e.target.value })}
            error={formErrors.project}
            required
          />

          <FormField
            label="Due Date"
            name="date"
            placeholder="e.g. Jul 18"
            value={newTask.date}
            onChange={(e) => setNewTask({ ...newTask, date: e.target.value })}
          />

          <FormField
            label="Assignee"
            name="assignee"
            type="select"
            value={newTask.assignee}
            onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
          >
            <option value="AM">Arjun Mehta (AM)</option>
            <option value="SQ">Sana Qureshi (SQ)</option>
            <option value="DP">Dev Patel (DP)</option>
            <option value="TN">Tara Nair (TN)</option>
          </FormField>
        </form>
      </Modal>
    </main>
  );
};
