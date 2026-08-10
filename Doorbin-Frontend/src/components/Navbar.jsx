import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, User } from 'lucide-react';
import { authService } from '../services/authService';

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getCurrentUser();
  const isAuthenticated = authService.isAuthenticated();

  // Hide top Navbar on Login, Dashboard, and root pages as they feature dedicated full-screen layouts
  if (location.pathname === '/login' || location.pathname === '/dashboard' || location.pathname === '/') {
    return null;
  }

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <header style={{
      backgroundColor: 'var(--color-bg-card)',
      borderBottom: '1px solid var(--color-border)',
      padding: 'var(--spacing-3) var(--spacing-6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
        <Link to="/" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-primary)', textDecoration: 'none' }}>
          Doorbin Visuals
        </Link>
      </div>

      <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
        {isAuthenticated ? (
          <>
            <Link to="/dashboard" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>
              <User size={16} color="var(--color-text-muted)" />
              <span style={{ fontWeight: 600 }}>
                {typeof user?.name === 'string' ? user.name : (user?.name?.name || user?.email || 'User')}
              </span>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>
              <LogOut size={16} />
              Logout
            </button>
          </>
        ) : (
          <Link to="/login" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem' }}>
            Login
          </Link>
        )}
      </nav>
    </header>
  );
};
