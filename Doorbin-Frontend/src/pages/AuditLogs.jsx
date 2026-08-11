import React, { useState, useEffect } from 'react';
import { auditService } from '../services/auditService';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { formatDateTime } from '../utils/dateUtils';
import { Activity, Search, Shield, User, Clock, LayoutGrid, List } from 'lucide-react';
import { useViewMode } from '../hooks/useViewMode';
import './Dashboard.css';

export const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [viewMode, setViewMode] = useViewMode();

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await auditService.getActivityLogs();
      const extractedLogs = Array.isArray(data) ? data : (data?.logs || data?.data || []);
      setLogs(extractedLogs);
    } catch (err) {
      setToast({ message: err.message || 'Failed to fetch activity audit logs', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const userName = typeof log.user === 'object' ? log.user?.name : log.user;
    return (
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.targetType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ipAddress?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      <div className="page-header-responsive">
        <div className="page-header-title-block">
          <h1 className="hero-serif-title">Activity Audit Logs</h1>
          <p className="hero-sub-summary">System-wide immutable audit trail of user actions, role modifications and IP addresses</p>
        </div>

        <div className="page-header-actions">
          {/* Dual View Toggle */}
          <div className="view-toggle-container">
            <button
              className={`view-toggle-btn ${viewMode === 'stripe' ? 'active' : ''}`}
              onClick={() => setViewMode('stripe')}
            >
              <List size={14} /> Stripe View
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid size={14} /> Card View
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <Loader text="Fetching system activity audit logs..." />
      ) : (
        <>
          {/* Search & Filter */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="search-input-wrapper" style={{ flex: 1, maxWidth: '380px' }}>
              <Search size={16} color="#8c8882" />
              <input
                type="text"
                placeholder="Search audit trail by user, action or IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="top-bar-search-input search-input-with-icon"
                style={{ width: '100%', paddingLeft: '2.5rem' }}
              />
            </div>
          </div>

          {/* DUAL VIEW CONDITIONAL RENDER */}
          {viewMode === 'card' ? (
            <div className="responsive-cards-grid">
              {filteredLogs.map((log) => {
                const userName = typeof log.user === 'object' ? (log.user?.name || log.user?.email || 'User') : log.user;
                const userRole = typeof log.user === 'object' ? (log.user?.role?.name || log.user?.role || 'Staff') : 'Staff';

                return (
                  <div key={log._id} className="responsive-card-item">
                    <div className="responsive-card-header">
                      <div>
                        <div className="responsive-card-title">{userName}</div>
                        <div className="responsive-card-subtitle">Role: {userRole}</div>
                      </div>
                      <span className="task-status-blue" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                        {log.action}
                      </span>
                    </div>

                    <div className="responsive-card-body">
                      <div><strong>Target:</strong> {log.targetType || 'System'} ({log.targetId || 'N/A'})</div>
                      <div><strong>IP Address:</strong> <span style={{ fontFamily: 'monospace' }}>{log.ipAddress || '192.168.1.1'}</span></div>
                    </div>

                    <div className="responsive-card-footer">
                      <span style={{ fontSize: '0.75rem', color: '#8c8882', fontFamily: 'monospace' }}>
                        {formatDateTime(log.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="team-widget-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#faf9f6', borderBottom: '1px solid #eeeae3', color: '#8c8882', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '1rem 1.25rem' }}>User Performing Action</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Action Code</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Target Entity</th>
                    <th style={{ padding: '1rem 1.25rem' }}>IP Address</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const userName = typeof log.user === 'object' ? (log.user?.name || log.user?.email || 'User') : log.user;
                    const userRole = typeof log.user === 'object' ? (log.user?.role?.name || log.user?.role || 'Staff') : 'Staff';

                    return (
                      <tr key={log._id} style={{ borderBottom: '1px solid #f2ece4' }}>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ fontWeight: 700, color: '#1a1918' }}>{userName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#8c8882' }}>Role: {userRole}</div>
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span className="task-status-blue" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', color: '#4a4742', fontWeight: 600 }}>
                          {log.targetType || 'System'} ({log.targetId || 'N/A'})
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#78746d' }}>
                          {log.ipAddress || '192.168.1.1'}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.78rem', color: '#8c8882' }}>
                          {formatDateTime(log.timestamp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
