import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { MainLayout } from '../components/MainLayout';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { Users } from '../pages/Users';
import { Departments } from '../pages/Departments';
import { Clients } from '../pages/Clients';
import { Enquiries } from '../pages/Enquiries';
import { Projects } from '../pages/Projects';
import { Tasks } from '../pages/Tasks';
import { TimelineGantt } from '../pages/TimelineGantt';
import { StudioCalendar } from '../pages/StudioCalendar';
import { ResourceAllocation } from '../pages/ResourceAllocation';
import { WorkflowTemplates } from '../pages/WorkflowTemplates';
import { RolesPermissions } from '../pages/RolesPermissions';
import { AuditLogs } from '../pages/AuditLogs';
import { UserProfile } from '../pages/UserProfile';
import { Finance } from '../pages/Finance';
import { Hrm } from '../pages/Hrm';
import { ReportsAnalytics } from '../pages/ReportsAnalytics';
import { NotFound } from '../pages/NotFound';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Public Auth Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Protected App Routes wrapped in MainLayout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Users />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/departments"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Departments />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Clients />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/enquiries"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Enquiries />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Projects />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Tasks />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/timeline"
        element={
          <ProtectedRoute>
            <MainLayout>
              <TimelineGantt />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <MainLayout>
              <StudioCalendar />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/resources"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ResourceAllocation />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/workflow-templates"
        element={
          <ProtectedRoute>
            <MainLayout>
              <WorkflowTemplates />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/roles-permissions"
        element={
          <ProtectedRoute>
            <MainLayout>
              <RolesPermissions />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute>
            <MainLayout>
              <AuditLogs />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/finance"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Finance />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/hrm"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Hrm />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ReportsAnalytics />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <MainLayout>
              <UserProfile />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* 404 Not Found Page */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
