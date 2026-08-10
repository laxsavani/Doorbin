import React from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../services/authService';

/**
 * SOP #10.3: Public Route Guard
 * Prevents authenticated users from accessing Login / Register pages
 */
export const PublicRoute = ({ children }) => {
  const isAuthenticated = authService.isAuthenticated();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
