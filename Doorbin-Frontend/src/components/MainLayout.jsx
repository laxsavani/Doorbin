import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { formatDate } from '../utils/dateUtils';
import {
  LogOut,
  LayoutDashboard,
  Users,
  Building,
  Building2,
  ChevronRight,
  ChevronDown,
  Shield,
  Activity,
  User,
  Menu,
  X,
  Briefcase,
  FolderKanban,
  Layers,
  CheckSquare,
  GitCommit,
  Calendar as CalendarIcon,
  PieChart,
  DollarSign,
  UserCheck,
  BarChart2
} from 'lucide-react';
import { ClockInOutWidget } from './ClockInOutWidget';
import { NotificationBell } from './NotificationBell';
import { notificationService } from '../services/notificationService';
import '../pages/Dashboard.css';

// System Roles & Permission Matrix
const ROLES_DATA = [
  {
    name: 'Director',
    permissions: {
      userManagement: true,
      departmentManagement: true,
      projectManagement: true,
      taskManagement: true,
      financeAccess: true,
      hrAccess: true,
      businessDevAccess: true,
      reportsAccess: true,
      dashboardAccess: true,
      resourceAllocation: true,
      calendarAccess: true,
      timelineAccess: true,
      deleteProjects: true,
      systemConfiguration: true
    }
  },
  {
    name: 'Production Manager',
    permissions: {
      userManagement: false,
      departmentManagement: false,
      projectManagement: true,
      taskManagement: true,
      financeAccess: false,
      hrAccess: false,
      businessDevAccess: false,
      reportsAccess: true,
      dashboardAccess: true,
      resourceAllocation: true,
      calendarAccess: true,
      timelineAccess: true,
      deleteProjects: false,
      systemConfiguration: false
    }
  },
  {
    name: 'Artist',
    permissions: {
      userManagement: false,
      departmentManagement: false,
      projectManagement: false,
      taskManagement: true,
      financeAccess: false,
      hrAccess: false,
      businessDevAccess: false,
      reportsAccess: false,
      dashboardAccess: true,
      resourceAllocation: false,
      calendarAccess: true,
      timelineAccess: false,
      deleteProjects: false,
      systemConfiguration: false
    }
  },
  {
    name: 'Human Resource',
    permissions: {
      userManagement: false,
      departmentManagement: false,
      projectManagement: false,
      taskManagement: false,
      financeAccess: false,
      hrAccess: true,
      businessDevAccess: false,
      reportsAccess: true,
      dashboardAccess: true,
      resourceAllocation: false,
      calendarAccess: true,
      timelineAccess: false,
      deleteProjects: false,
      systemConfiguration: false
    }
  },
  {
    name: 'Business Development Manager',
    permissions: {
      userManagement: false,
      departmentManagement: false,
      projectManagement: false,
      taskManagement: false,
      financeAccess: true,
      hrAccess: false,
      businessDevAccess: true,
      reportsAccess: true,
      dashboardAccess: true,
      resourceAllocation: false,
      calendarAccess: true,
      timelineAccess: false,
      deleteProjects: false,
      systemConfiguration: false
    }
  }
];

export const MainLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Dynamic Logged-in User Session Extraction
  const rawUser = authService.getCurrentUser();
  const userName = typeof rawUser?.name === 'string'
    ? rawUser.name
    : (rawUser?.name?.name || rawUser?.email || 'Lax Savani');

  const userRoleObj = rawUser?.role;
  const userRoleName = typeof userRoleObj === 'string'
    ? userRoleObj
    : (userRoleObj?.name || 'Director');

  // Extract Backend Permissions Object
  const activePermissions = (typeof userRoleObj === 'object' && userRoleObj?.permissions)
    ? userRoleObj.permissions
    : (rawUser?.permissions || ROLES_DATA.find(r => r.name.toLowerCase() === userRoleName.toLowerCase())?.permissions || ROLES_DATA[0].permissions);

  const checkPerm = (permissionKeys) => {
    if (!activePermissions) return false;
    const keys = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];
    return keys.some(key => Boolean(activePermissions[key]));
  };

  // Group Definitions matching Strict Role Access Matrix
  const isDirectorRole = userRoleName.toLowerCase() === 'director';

  const projectSubItems = [
    (isDirectorRole || checkPerm('projectManagement')) ? { title: 'Projects & Stages', path: '/projects', icon: FolderKanban } : null,
    (isDirectorRole || checkPerm(['taskManagement', 'projectManagement'])) ? { title: 'Task Management', path: '/tasks', icon: CheckSquare } : null,
    (isDirectorRole || checkPerm(['timelineAccess', 'projectManagement'])) ? { title: 'Gantt Timeline', path: '/timeline', icon: GitCommit } : null,
    (isDirectorRole || checkPerm(['calendarAccess', 'taskManagement', 'projectManagement'])) ? { title: 'Studio Calendar', path: '/calendar', icon: CalendarIcon } : null,
    (isDirectorRole || checkPerm(['resourceAllocation', 'projectManagement'])) ? { title: 'Resource Allocation', path: '/resources', icon: PieChart } : null
  ].filter(Boolean);

  const crmSubItems = [
    (isDirectorRole || checkPerm('businessDevAccess')) ? { title: 'Lead Management', path: '/enquiries', icon: Briefcase } : null,
    (isDirectorRole || checkPerm('businessDevAccess')) ? { title: 'Client Directory', path: '/clients', icon: Building2 } : null,
    (isDirectorRole || checkPerm(['financeAccess', 'businessDevAccess'])) ? { title: 'Finance Management', path: '/finance', icon: DollarSign } : null
  ].filter(Boolean);

  const hrSubItems = [
    (isDirectorRole || checkPerm('hrAccess')) ? { title: 'Attendance & HRM', path: '/hrm', icon: UserCheck } : null,
    (isDirectorRole || checkPerm('userManagement')) ? { title: 'User Directory', path: '/users', icon: Users } : null,
    (isDirectorRole || checkPerm('departmentManagement')) ? { title: 'Departments', path: '/departments', icon: Building } : null
  ].filter(Boolean);

  const systemSubItems = [
    (isDirectorRole || checkPerm('reportsAccess')) ? { title: 'Analytics & Reports', path: '/reports', icon: BarChart2 } : null,
    (isDirectorRole || checkPerm('systemConfiguration')) ? { title: 'Workflow Templates', path: '/workflow-templates', icon: Layers } : null,
    (isDirectorRole || checkPerm('systemConfiguration')) ? { title: 'Role & Permissions', path: '/roles-permissions', icon: Shield } : null,
    (isDirectorRole || checkPerm('systemConfiguration')) ? { title: 'Activity Audit Logs', path: '/audit-logs', icon: Activity } : null,
    { title: 'Account Settings', path: '/profile', icon: User }
  ].filter(Boolean);

  // Accordion Expand/Collapse State
  const [openGroups, setOpenGroups] = useState({
    projects: true,
    crm: true,
    workforce: false,
    system: false
  });

  // Auto-register Web Push Notification Subscription
  useEffect(() => {
    notificationService.registerWebPush();
  }, []);

  // Auto-expand active route parent group
  useEffect(() => {
    const currentPath = location.pathname;
    if (projectSubItems.some(i => i.path === currentPath)) {
      setOpenGroups(prev => ({ ...prev, projects: true }));
    } else if (crmSubItems.some(i => i.path === currentPath)) {
      setOpenGroups(prev => ({ ...prev, crm: true }));
    } else if (hrSubItems.some(i => i.path === currentPath)) {
      setOpenGroups(prev => ({ ...prev, workforce: true }));
    } else if (systemSubItems.some(i => i.path === currentPath)) {
      setOpenGroups(prev => ({ ...prev, system: true }));
    }
  }, [location.pathname]);

  const toggleGroup = (groupKey) => {
    setOpenGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // User initials calculation
  const userInitials = userName
    ? userName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
    : 'LS';

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handleNavClick = (path) => {
    navigate(path);
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="dashboard-layout">
      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className={`dashboard-sidebar ${isMobileSidebarOpen ? 'mobile-open' : ''}`}>
        {/* FIXED TOP LOGO BRAND HEADER */}
        <div className="sidebar-fixed-header">
          <img src="/logo.png" alt="Doorbin Visuals Logo" className="sidebar-logo-img" />
          <button
            className="mobile-sidebar-close-btn"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close sidebar menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* SCROLLABLE NAV CONTENT WITH ACCORDION GROUPS */}
        <div className="sidebar-nav-content">
          {/* Main Item: Dashboard */}
          <div className="sidebar-nav-group" style={{ marginBottom: '0.85rem' }}>
            <div
              className={`sidebar-nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
              onClick={() => handleNavClick('/dashboard')}
            >
              <div className="sidebar-nav-item-left">
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </div>
            </div>
          </div>

          {/* GROUP 1: PROJECTS & PRODUCTION */}
          {projectSubItems.length > 0 && (
            <div className="sidebar-nav-group">
              <div className="sidebar-group-label">PROJECTS & PRODUCTION</div>
              <div
                className="sidebar-parent-header"
                onClick={() => toggleGroup('projects')}
              >
                <div className="sidebar-parent-header-left">
                  <FolderKanban size={18} />
                  <span>Projects & Execution</span>
                </div>
                {openGroups.projects ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </div>
              {openGroups.projects && (
                <ul className="sidebar-sub-nav-list">
                  {projectSubItems.map((item, idx) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <li key={idx}>
                        <div
                          className={`sidebar-sub-nav-item ${isActive ? 'active' : ''}`}
                          onClick={() => handleNavClick(item.path)}
                        >
                          <Icon size={15} />
                          <span>{item.title}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* GROUP 2: CRM MODULES */}
          {crmSubItems.length > 0 && (
            <div className="sidebar-nav-group">
              <div className="sidebar-group-label">CRM MODULES</div>
              <div
                className="sidebar-parent-header"
                onClick={() => toggleGroup('crm')}
              >
                <div className="sidebar-parent-header-left">
                  <Building2 size={18} />
                  <span>Clients & CRM</span>
                </div>
                {openGroups.crm ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </div>
              {openGroups.crm && (
                <ul className="sidebar-sub-nav-list">
                  {crmSubItems.map((item, idx) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <li key={idx}>
                        <div
                          className={`sidebar-sub-nav-item ${isActive ? 'active' : ''}`}
                          onClick={() => handleNavClick(item.path)}
                        >
                          <Icon size={15} />
                          <span>{item.title}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* GROUP 3: WORKFORCE GROUP */}
          {hrSubItems.length > 0 && (
            <div className="sidebar-nav-group">
              <div className="sidebar-group-label">WORKFORCE GROUP</div>
              <div
                className="sidebar-parent-header"
                onClick={() => toggleGroup('workforce')}
              >
                <div className="sidebar-parent-header-left">
                  <UserCheck size={18} />
                  <span>HR & Attendance</span>
                </div>
                {openGroups.workforce ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </div>
              {openGroups.workforce && (
                <ul className="sidebar-sub-nav-list">
                  {hrSubItems.map((item, idx) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <li key={idx}>
                        <div
                          className={`sidebar-sub-nav-item ${isActive ? 'active' : ''}`}
                          onClick={() => handleNavClick(item.path)}
                        >
                          <Icon size={15} />
                          <span>{item.title}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* GROUP 4: ANALYTICS & SYSTEM */}
          {systemSubItems.length > 0 && (
            <div className="sidebar-nav-group">
              <div className="sidebar-group-label">ANALYTICS & SYSTEM</div>
              <div
                className="sidebar-parent-header"
                onClick={() => toggleGroup('system')}
              >
                <div className="sidebar-parent-header-left">
                  <BarChart2 size={18} />
                  <span>Analytics & Governance</span>
                </div>
                {openGroups.system ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </div>
              {openGroups.system && (
                <ul className="sidebar-sub-nav-list">
                  {systemSubItems.map((item, idx) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <li key={idx}>
                        <div
                          className={`sidebar-sub-nav-item ${isActive ? 'active' : ''}`}
                          onClick={() => handleNavClick(item.path)}
                        >
                          <Icon size={15} />
                          <span>{item.title}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* FIXED USER PROFILE FOOTER */}
        <div className="sidebar-footer-user">
          <div className="user-profile-row">
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
              onClick={() => handleNavClick('/profile')}
              title="Click to view profile"
            >
              <div className="user-avatar-badge">{userInitials}</div>
              <div>
                <div className="user-name-text">{userName}</div>
                <div className="user-role-text">{userRoleName.toUpperCase()}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="logout-icon-btn"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN CONTAINER */}
      <div className="dashboard-main-wrapper">
        {/* TOP BAR HEADER */}
        <div className="dashboard-top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="mobile-hamburger-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open sidebar menu"
            >
              <Menu size={18} />
            </button>
            <div className="top-bar-date">
              TODAY · {formatDate(new Date())}
            </div>
          </div>

          <div className="top-bar-right-controls" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ClockInOutWidget variant="topbar" />
            <NotificationBell />

          </div>
        </div>

        {/* CHILD PAGE CONTENT */}
        <div className="dashboard-content-scroll-area">
          {children}
        </div>
      </div>
    </div>
  );
};
