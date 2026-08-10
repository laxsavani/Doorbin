import React, { useState } from 'react';
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

  // Clean Sidebar Groups matching All 12 Backend Modules & Permissions
  const organizationModules = [
    checkPerm(['userManagement', 'systemConfiguration']) ? { title: 'User Management', path: '/users', icon: Users } : null,
    checkPerm(['departmentManagement', 'hrAccess', 'userManagement']) ? { title: 'Department Management', path: '/departments', icon: Building } : null,
    checkPerm(['hrAccess', 'userManagement']) ? { title: 'HR & Attendance', path: '/hrm', icon: UserCheck } : null,
    checkPerm(['businessDevAccess', 'userManagement', 'financeAccess']) ? { title: 'Clients & CRM', path: '/clients', icon: Building2 } : null,
    checkPerm(['businessDevAccess', 'projectManagement', 'userManagement']) ? { title: 'Enquiries & BD', path: '/enquiries', icon: Briefcase } : null,
    checkPerm(['projectManagement', 'userManagement']) ? { title: 'Projects & Stages', path: '/projects', icon: FolderKanban } : null,
    checkPerm(['taskManagement', 'projectManagement']) ? { title: 'Task Management', path: '/tasks', icon: CheckSquare } : null,
    checkPerm(['timelineAccess', 'projectManagement']) ? { title: 'Gantt Timeline', path: '/timeline', icon: GitCommit } : null,
    checkPerm(['calendarAccess', 'taskManagement']) ? { title: 'Studio Calendar', path: '/calendar', icon: CalendarIcon } : null,
    checkPerm(['resourceAllocation', 'systemConfiguration']) ? { title: 'Resource Allocation', path: '/resources', icon: PieChart } : null,
    checkPerm(['financeAccess', 'userManagement']) ? { title: 'Finance Management', path: '/finance', icon: DollarSign } : null,
  ].filter(Boolean);

  const systemModules = [
    checkPerm(['systemConfiguration', 'projectManagement']) ? { title: 'Workflow Templates', path: '/workflow-templates', icon: Layers } : null,
    checkPerm(['reportsAccess', 'projectManagement', 'financeAccess']) ? { title: 'Reports & Analytics', path: '/reports', icon: BarChart2 } : null,
    checkPerm(['systemConfiguration', 'userManagement']) ? { title: 'Role & Permissions', path: '/roles-permissions', icon: Shield } : null,
    checkPerm(['systemConfiguration', 'reportsAccess']) ? { title: 'Activity Audit Logs', path: '/audit-logs', icon: Activity } : null,
    { title: 'Account Settings', path: '/profile', icon: User }
  ].filter(Boolean);

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

        {/* SCROLLABLE MENU LIST */}
        <div className="sidebar-nav-content">
          {/* Main Item: Dashboard */}
          <div className="sidebar-nav-group">
            <ul className="sidebar-nav-list">
              <li>
                <div
                  className={`sidebar-nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
                  onClick={() => handleNavClick('/dashboard')}
                >
                  <div className="sidebar-nav-item-left">
                    <LayoutDashboard size={18} />
                    <span>Dashboard</span>
                  </div>
                </div>
              </li>
            </ul>
          </div>

          {/* Group: ORGANIZATION */}
          {organizationModules.length > 0 && (
            <div className="sidebar-nav-group">
              <div className="sidebar-group-label">ORGANIZATION</div>
              <ul className="sidebar-nav-list">
                {organizationModules.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <li key={idx}>
                      <div
                        className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleNavClick(item.path)}
                      >
                        <div className="sidebar-nav-item-left">
                          <Icon size={18} />
                          <span>{item.title}</span>
                        </div>
                        <ChevronRight size={14} className="sidebar-chevron-icon" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Group: SYSTEM & GOVERNANCE */}
          {systemModules.length > 0 && (
            <div className="sidebar-nav-group">
              <div className="sidebar-group-label">SYSTEM & GOVERNANCE</div>
              <ul className="sidebar-nav-list">
                {systemModules.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <li key={idx}>
                      <div
                        className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleNavClick(item.path)}
                      >
                        <div className="sidebar-nav-item-left">
                          <Icon size={18} />
                          <span>{item.title}</span>
                        </div>
                        <ChevronRight size={14} className="sidebar-chevron-icon" />
                      </div>
                    </li>
                  );
                })}
              </ul>
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
              <Menu size={20} color="#1F1F1F" />
            </button>
            <div className="top-bar-date">
              TODAY · {formatDate(new Date())}
            </div>
          </div>

          <div className="top-bar-right-controls" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ClockInOutWidget variant="topbar" />
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search tasks, projects..."
                className="top-bar-search-input"
              />
            </div>
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
