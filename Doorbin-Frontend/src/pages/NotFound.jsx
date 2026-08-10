import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';

export const NotFound = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 120px)',
      textAlign: 'center',
      padding: 'var(--spacing-6)'
    }}>
      <div style={{
        padding: 'var(--spacing-4)',
        backgroundColor: 'var(--color-danger-bg)',
        borderRadius: 'var(--radius-full)',
        marginBottom: 'var(--spacing-4)'
      }}>
        <AlertTriangle size={48} color="var(--color-danger)" />
      </div>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-text-main)' }}>
        404 - Page Not Found
      </h1>
      <p style={{
        fontSize: 'var(--font-size-base)',
        color: 'var(--color-text-muted)',
        maxWidth: '450px',
        margin: 'var(--spacing-2) 0 var(--spacing-6) 0'
      }}>
        The page or route you are attempting to access does not exist or has been relocated.
      </p>
      <Link to="/" className="btn btn-primary" style={{ padding: 'var(--spacing-3) var(--spacing-6)' }}>
        <Home size={18} />
        Back to Safety
      </Link>
    </div>
  );
};
