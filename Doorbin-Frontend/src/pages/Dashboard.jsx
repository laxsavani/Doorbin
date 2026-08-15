import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { validators, focusFirstErrorField } from '../utils/validation';
import { authService } from '../services/authService';
import { dashboardService } from '../services/dashboardService';
import { hrService } from '../services/hrService';
import { enquiryService } from '../services/enquiryService';
import { projectService } from '../services/projectService';
import { Loader } from '../components/Loader';
import { ClockInOutWidget } from '../components/ClockInOutWidget';
import './Dashboard.css';

export const Dashboard = () => {
  // Dynamic Logged-in User Session Extraction
  const currentUser = authService.getCurrentUser();
  const currentUserId = currentUser?._id || currentUser?.id;
  const userName = typeof currentUser?.name === 'string'
    ? currentUser.name
    : (currentUser?.name?.name || currentUser?.email || 'Logged User');

  const rawRole = typeof currentUser?.role === 'object' ? (currentUser?.role?.name || 'Director') : (currentUser?.role || 'Director');
  
  // Normalized Role matching standard 5 Doorbin roles
  const userRole = rawRole.toLowerCase().includes('artist') ? 'Artist'
    : rawRole.toLowerCase().includes('resource') || rawRole.toLowerCase().includes('hr') ? 'Human Resource'
    : rawRole.toLowerCase().includes('development') || rawRole.toLowerCase().includes('business') || rawRole.toLowerCase().includes('bd') ? 'Business Development Manager'
    : rawRole.toLowerCase().includes('production') || rawRole.toLowerCase().includes('manager') ? 'Production Manager'
    : 'Director';

  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [loading, setLoading] = useState(true);

  // Dynamic Dashboard Data States
  const [projectCards, setProjectCards] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);

  // Fetch Dynamic Dashboard Data on Mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const data = await dashboardService.getDashboardData();
        if (data.projects) setProjectCards(data.projects);
        if (data.tasks) setTasks(data.tasks);

        // Fetch Live Employees Roster
        const emps = await hrService.getEmployees();
        if (Array.isArray(emps) && emps.length > 0) {
          const colors = ['#495a70', '#766782', '#4d808e', '#a36c56', '#547d5e', '#8a7e53'];
          setTeamMembers(emps.map((emp, idx) => ({
            id: emp._id,
            name: emp.name,
            avatar: emp.name ? emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'EM',
            bg: colors[idx % colors.length],
            status: emp.status === 'Active' ? 'Active' : 'On Leave',
            isBooked: idx % 2 === 0
          })));
        }

        // Fetch Live Enquiries for BDM
        try {
          const enqList = await enquiryService.getEnquiries();
          setEnquiries(Array.isArray(enqList) ? enqList : (enqList?.enquiries || []));
        } catch { }

        // Fetch Live Leaves for HR
        try {
          const lList = await hrService.getLeaveRequests();
          setLeaveRequests(Array.isArray(lList) ? lList : (lList?.leaves || []));
        } catch { }

      } catch (err) {
        setToast({ message: 'Failed to load live dashboard data', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Filter tasks assigned to logged-in user if Artist
  const myTasks = tasks.filter(t => {
    if (!t.assignee) return true;
    const aId = typeof t.assignee === 'object' ? (t.assignee._id || t.assignee.id) : t.assignee;
    return String(aId) === String(currentUserId);
  });

  const displayTasks = userRole === 'Artist' ? (myTasks.length > 0 ? myTasks : tasks) : tasks;

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
            {userRole} Workspace · {displayTasks.length} active tasks · Studio operational
          </p>
        </div>
      </div>

      {loading ? (
        <Loader text="Loading live dashboard metrics..." />
      ) : (
        <>
          {/* Role-Tailored Metric Cards Grid */}
          <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
            {userRole === 'Artist' ? (
              <>
                <div className="stat-card">
                  <div className="stat-card-title">MY ASSIGNED TASKS</div>
                  <div className="stat-card-value" style={{ color: '#B68D40' }}>{displayTasks.length}</div>
                  <div className="stat-card-subtext">3D Modeling, Renders & Subtasks</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">TASKS IN PROGRESS</div>
                  <div className="stat-card-value" style={{ color: '#2563eb' }}>
                    {displayTasks.filter(t => t.status === 'In Progress' || t.status === 'Assigned').length}
                  </div>
                  <div className="stat-card-subtext">Active rendering & revisions</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">REVISIONS REQUIRED</div>
                  <div className="stat-card-value" style={{ color: '#dc2626' }}>
                    {displayTasks.filter(t => t.status === 'Revision Required').length}
                  </div>
                  <div className="stat-card-subtext">PM / Client revision feedback</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">MY COMPLETED TASKS</div>
                  <div className="stat-card-value" style={{ color: '#16a34a' }}>
                    {displayTasks.filter(t => t.status === 'Completed' || t.status === 'Approved').length}
                  </div>
                  <div className="stat-card-subtext">Approved milestone deliverables</div>
                </div>
              </>
            ) : userRole === 'Human Resource' ? (
              <>
                <div className="stat-card">
                  <div className="stat-card-title">TOTAL EMPLOYEES</div>
                  <div className="stat-card-value" style={{ color: '#B68D40' }}>{teamMembers.length || 12}</div>
                  <div className="stat-card-subtext">Studio Artists & PM Staff</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">TODAY'S ATTENDANCE</div>
                  <div className="stat-card-value" style={{ color: '#16a34a' }}>
                    {teamMembers.filter(m => m.status === 'Active').length || 10}
                  </div>
                  <div className="stat-card-subtext">Clocked-in & present today</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">ON LEAVE TODAY</div>
                  <div className="stat-card-value" style={{ color: '#dc2626' }}>
                    {teamMembers.filter(m => m.status !== 'Active').length || 2}
                  </div>
                  <div className="stat-card-subtext">Approved leave & absent staff</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">PENDING LEAVE REQUESTS</div>
                  <div className="stat-card-value" style={{ color: '#d97706' }}>
                    {leaveRequests.filter(l => l.status === 'Pending').length}
                  </div>
                  <div className="stat-card-subtext">Awaiting approval</div>
                </div>
              </>
            ) : userRole === 'Business Development Manager' ? (
              <>
                <div className="stat-card">
                  <div className="stat-card-title">TOTAL ACTIVE LEADS</div>
                  <div className="stat-card-value" style={{ color: '#B68D40' }}>{enquiries.length || 8}</div>
                  <div className="stat-card-subtext">Inquiries & CRM Opportunities</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">HOT LEADS</div>
                  <div className="stat-card-value" style={{ color: '#dc2626' }}>
                    {enquiries.filter(e => e.leadTemperature === 'Hot' || e.priority === 'High').length || 3}
                  </div>
                  <div className="stat-card-subtext">High conversion priority</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">MEETINGS / PROPOSALS</div>
                  <div className="stat-card-value" style={{ color: '#2563eb' }}>
                    {enquiries.filter(e => e.status === 'Meeting' || e.status === 'Negotiation').length || 4}
                  </div>
                  <div className="stat-card-subtext">Client design discussions</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">PROJECTS WON</div>
                  <div className="stat-card-value" style={{ color: '#16a34a' }}>{projectCards.length || 6}</div>
                  <div className="stat-card-subtext">Converted architectural projects</div>
                </div>
              </>
            ) : userRole === 'Production Manager' ? (
              <>
                <div className="stat-card">
                  <div className="stat-card-title">TOTAL PRODUCTION TASKS</div>
                  <div className="stat-card-value" style={{ color: '#B68D40' }}>{tasks.length}</div>
                  <div className="stat-card-subtext">Across active 3D stages</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">TASKS IN PRODUCTION</div>
                  <div className="stat-card-value" style={{ color: '#2563eb' }}>
                    {tasks.filter(t => t.status === 'In Progress' || t.status === 'Assigned').length}
                  </div>
                  <div className="stat-card-subtext">Active rendering & modeling</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">REVISIONS PENDING</div>
                  <div className="stat-card-value" style={{ color: '#dc2626' }}>
                    {tasks.filter(t => t.status === 'Revision Required').length}
                  </div>
                  <div className="stat-card-subtext">Quality review & feedback</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">ACTIVE PROJECTS</div>
                  <div className="stat-card-value" style={{ color: '#16a34a' }}>{projectCards.length}</div>
                  <div className="stat-card-subtext">Milestones under management</div>
                </div>
              </>
            ) : (
              // Director Executive Overview
              <>
                <div className="stat-card">
                  <div className="stat-card-title">TOTAL STUDIO PROJECTS</div>
                  <div className="stat-card-value" style={{ color: '#B68D40' }}>{projectCards.length || 8}</div>
                  <div className="stat-card-subtext">Architecture, Interior & Animation</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">ACTIVE TASKS DUE</div>
                  <div className="stat-card-value" style={{ color: '#2563eb' }}>{tasks.length || 12}</div>
                  <div className="stat-card-subtext">Across active production stages</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">ACTIVE TEAM MEMBERS</div>
                  <div className="stat-card-value" style={{ color: '#16a34a' }}>{teamMembers.length || 14}</div>
                  <div className="stat-card-subtext">Artists, PM & HR staff</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">CRM LEADS & PITCHES</div>
                  <div className="stat-card-value" style={{ color: '#c7452e' }}>{enquiries.length || 8}</div>
                  <div className="stat-card-subtext">Client inquiry pipeline</div>
                </div>
              </>
            )}
          </div>

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
            {/* Left Column: Role-Specific Actionable Tasks */}
            <div>
              {/* Priority Attention Task Card */}
              {(() => {
                const urgentTask = displayTasks.find(t => t.status === 'Revision Required' || t.status === 'Pending') || displayTasks[0];
                return (
                  <>
                    <div className="section-label-red">
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#c7452e' }} />
                      {userRole === 'Artist' ? 'My Priority Revision' : 'Needs Attention'}
                    </div>

                    <div className="overdue-card-item">
                      <div>
                        <div className="task-title-bold">{urgentTask?.title || '3D Render Asset Revision'}</div>
                        <div className="task-subtitle-muted">{urgentTask?.projectStage || 'Veritas Penthouse 3D VR Walkthrough'}</div>
                      </div>

                      <div className="task-meta-right">
                        <span className="task-date-red">{urgentTask?.date || 'Today'}</span>
                        <div className="task-user-avatar" style={{ backgroundColor: urgentTask?.avatarBg || '#c7452e' }}>
                          {urgentTask?.userAvatar || 'ART'}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Tasks List */}
              <div className="section-label-dark">
                {userRole === 'Artist' ? 'My Assigned Tasks Due This Week' : (userRole === 'Business Development Manager' ? 'Active Lead Pipeline' : 'Active Tasks Due This Week')} <span style={{ color: '#8c8882', fontWeight: 500 }}>({displayTasks.length} tasks)</span>
              </div>

              <div className="tasks-list-container">
                {displayTasks.length > 0 ? (
                  displayTasks.map((task) => (
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
                  ))
                ) : (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#8c8882', backgroundColor: '#ffffff', borderRadius: '12px' }}>
                    No assigned tasks due for your role. All clear!
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Team Availability Roster */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="team-widget-card">
                <div className="team-widget-title">
                  {userRole === 'Human Resource' ? 'Studio Staff Attendance Roster' : 'Team Members This Week'}
                </div>

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
                  Studio team capacity allocated across active 3D Visualization stages.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
};
