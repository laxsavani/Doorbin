import React, { useState, useEffect } from 'react';
import { reportService } from '../services/reportService';
import { useViewMode } from '../hooks/useViewMode';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { formatDate } from '../utils/dateUtils';
import {
  LayoutGrid,
  AlignJustify,
  PieChart,
  FileSpreadsheet,
  FileText,
  Download,
  Mail,
  Plus,
  Clock,
  CheckCircle2,
  TrendingUp,
  BarChart2,
  Trash2
} from 'lucide-react';
import './Dashboard.css';

export const ReportsAnalytics = () => {
  const [activeTab, setActiveTab] = useState('projects');
  const [viewMode, setViewMode] = useViewMode('card'); // 'projects' | 'employees' | 'finance' | 'productivity' | 'scheduled'
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Data states
  const [projectReport, setProjectReport] = useState(null);
  const [employeeReport, setEmployeeReport] = useState(null);
  const [financeReport, setFinanceReport] = useState(null);
  const [productivityReport, setProductivityReport] = useState(null);
  const [scheduledReports, setScheduledReports] = useState([]);

  // Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    reportTitle: '',
    frequency: 'Weekly',
    dayOfWeek: 'Monday',
    time: '08:00 AM',
    recipients: '',
    category: 'projects',
    exportFormat: 'pdf'
  });

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [projData, empData, finData, prodData, schedData] = await Promise.all([
        reportService.getProjectReports(),
        reportService.getEmployeeReports(),
        reportService.getFinanceReports(),
        reportService.getProductivityReports(),
        reportService.getScheduledReports()
      ]);

      setProjectReport(projData);
      setEmployeeReport(empData);
      setFinanceReport(finData);
      setProductivityReport(prodData);
      setScheduledReports(schedData || []);
    } catch (err) {
      setToast({ message: 'Failed to load report analytics', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Export Download Trigger
  const handleExport = async (category, format) => {
    try {
      await reportService.exportReport(category, 'summary', format);
      setToast({ message: `Streaming export for ${category.toUpperCase()} (${format.toUpperCase()}) initialized!`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to download report', type: 'error' });
    }
  };

  // Create Scheduled Report Handler
  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleForm.reportTitle || !scheduleForm.recipients) {
      setToast({ message: 'Please complete report title and recipient emails', type: 'error' });
      return;
    }

    try {
      const recipientList = scheduleForm.recipients.split(',').map(email => email.trim()).filter(Boolean);
      const newSchedule = await reportService.createScheduledReport({
        ...scheduleForm,
        recipients: recipientList
      });

      setScheduledReports(prev => [newSchedule, ...prev]);
      setIsScheduleModalOpen(false);
      setToast({ message: 'Automated email report scheduled!', type: 'success' });
      setScheduleForm({ reportTitle: '', frequency: 'Weekly', dayOfWeek: 'Monday', time: '08:00 AM', recipients: '', category: 'projects', exportFormat: 'pdf' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to schedule report', type: 'error' });
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (id) => {
    try {
      await reportService.deleteScheduledReport(id);
      setScheduledReports(prev => prev.filter(s => s._id !== id));
      setToast({ message: 'Scheduled report removed', type: 'info' });
    } catch (err) {
      setToast({ message: 'Failed to delete schedule', type: 'error' });
    }
  };

  if (loading) {
    return <Loader message="Loading Module 12: Executive Reports & Analytics..." />;
  }

  return (
    <div className="main-content smooth-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER BAR */}
      <div className="page-header-responsive">
        <div className="page-header-title-block">
          <h1 className="hero-serif-title" style={{ color: 'var(--color-secondary)' }}>
            Executive Reporting & Analytics Engine
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Filterable performance metrics, streaming Excel/PDF exports & automated scheduled emails
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div className="view-mode-toggle" style={{ display: 'inline-flex', background: '#f5efe6', padding: '0.2rem', borderRadius: '8px', border: '1px solid #e2ded8', gap: '0.2rem' }}>
            <button
              type="button"
              className={`btn btn-icon ${viewMode === 'stripe' ? 'active' : ''}`}
              style={{
                padding: '0.4rem 0.6rem',
                backgroundColor: viewMode === 'stripe' ? '#ffffff' : 'transparent',
                boxShadow: viewMode === 'stripe' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={() => setViewMode('stripe')}
              title="Table View"
            >
              <AlignJustify size={16} color={viewMode === 'stripe' ? '#aa653e' : '#6b7280'} />
            </button>
            <button
              type="button"
              className={`btn btn-icon ${viewMode === 'card' ? 'active' : ''}`}
              style={{
                padding: '0.4rem 0.6rem',
                backgroundColor: viewMode === 'card' ? '#ffffff' : 'transparent',
                boxShadow: viewMode === 'card' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={() => setViewMode('card')}
              title="Card View"
            >
              <LayoutGrid size={16} color={viewMode === 'card' ? '#aa653e' : '#6b7280'} />
            </button>
          </div>
          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
            <button className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }} onClick={() => handleExport(activeTab, 'excel')}>
              <FileSpreadsheet size={15} /> Export Excel
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }} onClick={() => handleExport(activeTab, 'pdf')}>
              <FileText size={15} /> Export PDF
            </button>
          </div>
          <button className="btn btn-primary" style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }} onClick={() => setIsScheduleModalOpen(true)}>
            <Mail size={15} /> Schedule Digest
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS & MOBILE SELECT */}
      <div className="responsive-filter-bar">
        <div className="desktop-tabs-container">
          {['projects', 'employees', 'finance', 'productivity', 'scheduled'].map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              style={{
                padding: '0.75rem 1.25rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tabKey ? '3px solid var(--color-primary)' : 'none',
                fontWeight: activeTab === tabKey ? '600' : '400',
                color: activeTab === tabKey ? 'var(--color-primary)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tabKey === 'scheduled' ? 'Scheduled Digests' : `${tabKey} Reports`}
            </button>
          ))}
        </div>

        {/* Mobile Filter Select Dropdown */}
        <select
          className="mobile-filter-select"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
        >
          <option value="projects">Projects Reports</option>
          <option value="employees">Employees Reports</option>
          <option value="finance">Finance Reports</option>
          <option value="productivity">Productivity Reports</option>
          <option value="scheduled">Scheduled Digests</option>
        </select>
      </div>

      {/* TAB 1: PROJECT REPORTS */}
      {activeTab === 'projects' && (
        <div>
          {(() => {
            const summary = projectReport?.summary || { totalProjects: 0, activeCount: 0, avgCompletionPercentage: 0, delayedCount: 0 };
            const projectsList = Array.isArray(projectReport?.projectsList) ? projectReport.projectsList : (Array.isArray(projectReport) ? projectReport : []);
            return (
              <>
                <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div className="stat-card-title">TOTAL PROJECTS</div>
                    <div className="stat-card-value">{summary.totalProjects || 0}</div>
                    <div className="stat-card-subtext">{summary.activeCount || 0} Active In-Production</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-title">AVG COMPLETION %</div>
                    <div className="stat-card-value" style={{ color: 'var(--color-primary)' }}>{summary.avgCompletionPercentage || 0}%</div>
                    <div className="stat-card-subtext">Weighted stage progress</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-title">DELAYED PROJECTS</div>
                    <div className="stat-card-value" style={{ color: 'var(--color-danger)' }}>{summary.delayedCount || 0}</div>
                    <div className="stat-card-subtext">Action required</div>
                  </div>
                </div>

                {viewMode === 'card' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {projectsList.map((p, idx) => {
                      const prog = p.progressPercentage || p.progress || 0;
                      const isDelayed = (p.delayDays || 0) > 0;
                      return (
                        <div key={idx} className="stat-card" style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid #e5e0d5', borderRadius: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1918' }}>{p.projectName || p.title || 'Untitled Project'}</h4>
                            <span className={`badge ${p.status === 'Completed' ? 'badge-success' : p.status === 'Delayed' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                              {p.status || 'In Progress'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>{p.category || p.projectCategory || 'Architecture'}</span>
                            <span style={{ fontSize: '0.75rem', color: isDelayed ? 'var(--color-danger)' : '#15803d', fontWeight: 600 }}>
                              {isDelayed ? `⚠️ +${p.delayDays}d Delay` : '✅ On Schedule'}
                            </span>
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem', fontWeight: 600, color: '#6b7280' }}>
                              <span>Progress</span>
                              <span>{prog}%</span>
                            </div>
                            <div style={{ backgroundColor: 'var(--color-border)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${prog}%`, backgroundColor: 'var(--color-primary)', height: '100%' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', paddingTop: '0.5rem', borderTop: '1px solid #f0ece1' }}>
                            <div>
                              <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase' }}>Budget</div>
                              <div style={{ fontWeight: 700, color: '#1a1918' }}>₹{(p.budget || 0).toLocaleString('en-IN')}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase' }}>Status</div>
                              <div style={{ fontWeight: 600, color: '#aa653e' }}>{p.status || 'Active'}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>PROJECT TITLE</th>
                          <th>CATEGORY</th>
                          <th>PROGRESS</th>
                          <th>DELAY (DAYS)</th>
                          <th>BUDGET (₹)</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectsList.map((p, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{p.projectName || p.title || 'Untitled Project'}</td>
                            <td>{p.category || p.projectCategory || 'Architecture'}</td>
                            <td>{p.progressPercentage || p.progress || 0}%</td>
                            <td style={{ color: (p.delayDays || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{p.delayDays || 0} days</td>
                            <td>₹{(p.budget || 0).toLocaleString('en-IN')}</td>
                            <td>
                              <span className={`badge ${p.status === 'Completed' ? 'badge-success' : p.status === 'Delayed' ? 'badge-danger' : 'badge-warning'}`}>
                                {p.status || 'In Progress'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* TAB 2: EMPLOYEE REPORTS */}
      {activeTab === 'employees' && (
        <div>
          {(() => {
            const overallUtilization = employeeReport?.overallUtilization || 0;
            const employeeMetrics = Array.isArray(employeeReport?.employeeMetrics) ? employeeReport.employeeMetrics : [];
            return (
              <>
                <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div className="stat-card-title">STUDIO UTILIZATION RATE</div>
                    <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>{overallUtilization}%</div>
                    <div className="stat-card-subtext">Capacity allocated vs available</div>
                  </div>
                </div>

                {viewMode === 'card' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {employeeMetrics.map((e, idx) => (
                      <div key={idx} className="stat-card" style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid #e5e0d5', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1918' }}>{e.name}</h4>
                          <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>{e.role}</span>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem', fontWeight: 600, color: '#6b7280' }}>
                            <span>Utilization Rate</span>
                            <span>{e.utilizationRate}</span>
                          </div>
                          <div style={{ backgroundColor: 'var(--color-border)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: String(e.utilizationRate).includes('%') ? e.utilizationRate : `${e.utilizationRate}%`, backgroundColor: 'var(--color-primary)', height: '100%' }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #f0ece1', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>✓ {e.completedTasks} Done</span>
                            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>⏳ {e.pendingTasks} Pending</span>
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                            ⭐ {e.performanceScore} / 10
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>ARTIST / MANAGER</th>
                          <th>ROLE</th>
                          <th>TASKS COMPLETED</th>
                          <th>PENDING TASKS</th>
                          <th>UTILIZATION RATE</th>
                          <th>PERFORMANCE RATING</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeMetrics.map((e, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{e.name}</td>
                            <td>{e.role}</td>
                            <td>{e.completedTasks}</td>
                            <td>{e.pendingTasks}</td>
                            <td>{e.utilizationRate}</td>
                            <td style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{e.performanceScore} / 10</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* TAB 3: FINANCE REPORTS */}
      {activeTab === 'finance' && (
        <div>
          {(() => {
            const totalRevenue = financeReport?.totalRevenue || 0;
            const totalCollected = financeReport?.totalCollected || 0;
            const estimatedProfitabilityMargin = financeReport?.estimatedProfitabilityMargin || '0%';
            return (
              <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="stat-card">
                  <div className="stat-card-title">TOTAL REVENUE YTD</div>
                  <div className="stat-card-value">₹{(totalRevenue / 100000).toFixed(2)} L</div>
                  <div className="stat-card-subtext">Gross invoiced volume</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">COLLECTED REVENUE</div>
                  <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>₹{(totalCollected / 100000).toFixed(2)} L</div>
                  <div className="stat-card-subtext">Realized bank inflow</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-title">EST. PROFIT MARGIN</div>
                  <div className="stat-card-value" style={{ color: 'var(--color-primary)' }}>{estimatedProfitabilityMargin}</div>
                  <div className="stat-card-subtext">Gross margin percentage</div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 4: PRODUCTIVITY REPORTS */}
      {activeTab === 'productivity' && (
        <div>
          {(() => {
            const avgTime = productivityReport?.avgTaskCompletionTimeDays || 0;
            const departmentEfficiency = Array.isArray(productivityReport?.departmentEfficiency) ? productivityReport.departmentEfficiency : [];
            const delayCausesBreakdown = Array.isArray(productivityReport?.delayCausesBreakdown) ? productivityReport.delayCausesBreakdown : [];
            return (
              <>
                <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div className="stat-card-title">AVG TASK TURNAROUND</div>
                    <div className="stat-card-value">{avgTime} Days</div>
                    <div className="stat-card-subtext">Average completion velocity</div>
                  </div>
                </div>

                <div className="reports-dual-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  <div className="table-responsive">
                    <div style={{ padding: '1rem', fontWeight: '600', borderBottom: '1px solid var(--color-border)' }}>Department Efficiency Rates</div>
                    <table className="table">
                      <tbody>
                        {departmentEfficiency.map((d, idx) => (
                          <tr key={idx}>
                            <td>{d.department}</td>
                            <td style={{ fontWeight: '700', color: 'var(--color-success)' }}>{d.efficiencyRate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="table-responsive">
                    <div style={{ padding: '1rem', fontWeight: '600', borderBottom: '1px solid var(--color-border)' }}>Delay Cause Breakdown</div>
                    <table className="table">
                      <tbody>
                        {delayCausesBreakdown.map((c, idx) => (
                          <tr key={idx}>
                            <td>{c.cause}</td>
                            <td style={{ fontWeight: '700', color: 'var(--color-warning)' }}>{c.percentage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* TAB 5: SCHEDULED REPORTS */}
      {activeTab === 'scheduled' && (
        viewMode === 'card' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {scheduledReports.map(s => (
              <div key={s._id} className="stat-card" style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid #e5e0d5', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1918' }}>{s.reportTitle}</h4>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{s.exportFormat?.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>📅 {s.frequency} ({s.dayOfWeek || `Day ${s.dayOfMonth}`})</span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>⏰ {s.time}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#4b5563', wordBreak: 'break-all' }}>
                  <strong>To:</strong> {Array.isArray(s.recipients) ? s.recipients.join(', ') : s.recipients}
                </div>
                <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #f0ece1', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', color: 'var(--color-danger)', fontSize: '0.75rem' }} onClick={() => handleDeleteSchedule(s._id)}>
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>TITLE</th>
                  <th>FREQUENCY</th>
                  <th>TIME</th>
                  <th>RECIPIENT EMAILS</th>
                  <th>FORMAT</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {scheduledReports.map(s => (
                  <tr key={s._id}>
                    <td style={{ fontWeight: '600' }}>{s.reportTitle}</td>
                    <td><span className="badge badge-secondary">{s.frequency} ({s.dayOfWeek || `Day ${s.dayOfMonth}`})</span></td>
                    <td>{s.time}</td>
                    <td>{Array.isArray(s.recipients) ? s.recipients.join(', ') : s.recipients}</td>
                    <td><span className="badge badge-success">{s.exportFormat?.toUpperCase()}</span></td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', color: 'var(--color-danger)' }} onClick={() => handleDeleteSchedule(s._id)}>
                        <Trash2 size={14} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* SCHEDULE DIGEST MODAL */}
      {isScheduleModalOpen && (
        <Modal isOpen={isScheduleModalOpen} title="Configure Automated Email Digest" onClose={() => setIsScheduleModalOpen(false)}>
          <form onSubmit={handleCreateSchedule}>
            <FormField label="Report Title" name="reportTitle" value={scheduleForm.reportTitle} onChange={e => setScheduleForm({ ...scheduleForm, reportTitle: e.target.value })} placeholder="e.g. Weekly Executive Production Digest" required />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormField label="Category" name="category" type="select" value={scheduleForm.category} onChange={e => setScheduleForm({ ...scheduleForm, category: e.target.value })}>
                <option value="projects">Projects & Workflow</option>
                <option value="employees">Employee Productivity</option>
                <option value="finance">Financial Receivables</option>
                <option value="productivity">Productivity & Delays</option>
              </FormField>

              <FormField label="Export Format" name="exportFormat" type="select" value={scheduleForm.exportFormat} onChange={e => setScheduleForm({ ...scheduleForm, exportFormat: e.target.value })}>
                <option value="pdf">PDF Document</option>
                <option value="excel">Excel Spreadsheet</option>
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormField label="Frequency" name="frequency" type="select" value={scheduleForm.frequency} onChange={e => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </FormField>

              <FormField label="Delivery Time" name="time" value={scheduleForm.time} onChange={e => setScheduleForm({ ...scheduleForm, time: e.target.value })} placeholder="08:00 AM" />
            </div>

            <FormField label="Recipient Emails (Comma separated)" name="recipients" value={scheduleForm.recipients} onChange={e => setScheduleForm({ ...scheduleForm, recipients: e.target.value })} placeholder="director@doorbin.com, pm@doorbin.com" required />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsScheduleModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Schedule Report</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
