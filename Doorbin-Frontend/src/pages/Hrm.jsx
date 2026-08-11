import React, { useState, useEffect } from 'react';
import { hrService } from '../services/hrService';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { formatDate } from '../utils/dateUtils';
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  Award,
  Plus,
  CheckCircle2,
  XCircle,
  FileText,
  Trash2,
  LayoutGrid,
  List
} from 'lucide-react';
import { ClockInOutWidget } from '../components/ClockInOutWidget';
import { useViewMode } from '../hooks/useViewMode';
import './Dashboard.css';

export const Hrm = () => {
  const [activeTab, setActiveTab] = useState('employees'); // 'employees' | 'attendance' | 'leave' | 'holidays' | 'reviews'
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [viewMode, setViewMode] = useViewMode();

  // Data states
  const [employees, setEmployees] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [reviews, setReviews] = useState([]);

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Forms
  const [empForm, setEmpForm] = useState({ name: '', email: '', phone: '', designation: '', role: 'Artist', monthlySalary: '' });
  const [leaveForm, setLeaveForm] = useState({ employeeId: '', leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' });
  const [holidayForm, setHolidayForm] = useState({ holidayName: '', date: '', type: 'Festival' });
  const [reviewForm, setReviewForm] = useState({ employeeId: '', reviewPeriod: 'Q3 2026', qualityScore: 9, timelinessScore: 8, teamworkScore: 9, feedback: '' });

  useEffect(() => {
    loadHrmData();
  }, []);

  const loadHrmData = async () => {
    setLoading(true);
    try {
      const [empsData, attsData, leavesData, holsData, revsData] = await Promise.all([
        hrService.getEmployees(),
        hrService.getAttendanceLogs(),
        hrService.getLeaveRequests(),
        hrService.getHolidays(),
        hrService.getPerformanceReviews()
      ]);

      setEmployees(empsData || []);
      setAttendanceLogs(attsData || []);
      setLeaveRequests(leavesData || []);
      setHolidays(holsData || []);
      setReviews(revsData || []);
    } catch (err) {
      setToast({ message: 'Failed to load HRM data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Add Employee Handler
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!empForm.name || !empForm.email || !empForm.designation) {
      setToast({ message: 'Please complete mandatory employee details', type: 'error' });
      return;
    }

    try {
      const newEmp = await hrService.createEmployee(empForm);
      setEmployees(prev => [newEmp, ...prev]);
      setIsEmployeeModalOpen(false);
      setToast({ message: `Employee ${newEmp.name} onboarded!`, type: 'success' });
      setEmpForm({ name: '', email: '', phone: '', designation: '', role: 'Artist', monthlySalary: '' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to onboard employee', type: 'error' });
    }
  };

  // Apply Leave Handler
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.employeeId || !leaveForm.startDate || !leaveForm.endDate) {
      setToast({ message: 'Please fill in leave duration & employee', type: 'error' });
      return;
    }

    try {
      const selectedEmp = employees.find(emp => emp._id === leaveForm.employeeId);
      const newLeave = await hrService.applyLeave({
        employee: selectedEmp ? { _id: selectedEmp._id, name: selectedEmp.name, employeeCode: selectedEmp.employeeCode } : { name: 'Staff' },
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        totalDays: 2,
        reason: leaveForm.reason
      });

      setLeaveRequests(prev => [newLeave, ...prev]);
      setIsLeaveModalOpen(false);
      setToast({ message: 'Leave application submitted!', type: 'success' });
      setLeaveForm({ employeeId: '', leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to apply leave', type: 'error' });
    }
  };

  // Approve / Reject Leave Handler
  const handleLeaveStatus = async (id, status) => {
    try {
      const updated = await hrService.updateLeaveStatus(id, { status });
      setLeaveRequests(prev => prev.map(l => l._id === id ? { ...l, status, approvedBy: { name: 'Lax Savani' } } : l));
      setToast({ message: `Leave application ${status.toLowerCase()}!`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to update leave status', type: 'error' });
    }
  };

  // Add Holiday Handler
  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!holidayForm.holidayName || !holidayForm.date) {
      setToast({ message: 'Holiday name and date are required', type: 'error' });
      return;
    }

    try {
      const newHol = await hrService.addHoliday(holidayForm);
      setHolidays(prev => [...prev, newHol]);
      setIsHolidayModalOpen(false);
      setToast({ message: 'Studio holiday added!', type: 'success' });
      setHolidayForm({ holidayName: '', date: '', type: 'Festival' });
    } catch (err) {
      setToast({ message: 'Failed to add holiday', type: 'error' });
    }
  };

  // Add Performance Review Handler
  const handleAddReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.employeeId) {
      setToast({ message: 'Please select an employee for review', type: 'error' });
      return;
    }

    try {
      const selectedEmp = employees.find(e => e._id === reviewForm.employeeId);
      const newRev = await hrService.createPerformanceReview({
        employee: { _id: selectedEmp._id, name: selectedEmp.name },
        reviewPeriod: reviewForm.reviewPeriod,
        qualityScore: Number(reviewForm.qualityScore),
        timelinessScore: Number(reviewForm.timelinessScore),
        teamworkScore: Number(reviewForm.teamworkScore),
        feedback: reviewForm.feedback
      });

      setReviews(prev => [newRev, ...prev]);
      setIsReviewModalOpen(false);
      setToast({ message: 'Performance appraisal recorded!', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to save review', type: 'error' });
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee record?')) return;
    try {
      await hrService.deleteEmployee(id);
      setEmployees(prev => prev.filter(e => e._id !== id));
      setToast({ message: 'Employee record deleted', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete employee', type: 'error' });
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await hrService.deleteHoliday(id);
      setHolidays(prev => prev.filter(h => h._id !== id));
      setToast({ message: 'Holiday deleted', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete holiday', type: 'error' });
    }
  };

  if (loading) {
    return <Loader message="Loading Module 10: Human Resource Management..." />;
  }

  return (
    <div className="main-content smooth-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER BAR */}
      <div className="page-header-responsive">
        <div className="page-header-title-block">
          <h1 style={{ fontSize: '2rem', color: 'var(--color-secondary)', margin: 0 }}>
            Human Resource Management (HRM)
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Staff onboarding, attendance logging, leave approvals, studio holiday calendar & performance appraisals
          </p>
        </div>

        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => setIsLeaveModalOpen(true)}>
            <Calendar size={16} /> Apply Leave
          </button>
          <button className="btn btn-secondary" onClick={() => setIsReviewModalOpen(true)}>
            <Award size={16} /> Performance Appraisal
          </button>
          <button className="btn btn-primary" onClick={() => setIsEmployeeModalOpen(true)}>
            <Plus size={16} /> Onboard Staff
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-title">TOTAL ACTIVE STAFF</div>
            <div className="stat-card-icon" style={{ backgroundColor: 'rgba(182, 141, 64, 0.1)', color: 'var(--color-primary)' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="stat-card-value">{employees.length}</div>
          <div className="stat-card-subtext">Across 3 Operational Departments</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-title">TODAY'S ATTENDANCE</div>
            <div className="stat-card-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
              <UserCheck size={20} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>
            {attendanceLogs.filter(a => a.status === 'Present').length} Present
          </div>
          <div className="stat-card-subtext">{attendanceLogs.filter(a => a.status === 'On Leave').length} Staff on Leave today</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-title">PENDING LEAVE REQUESTS</div>
            <div className="stat-card-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--color-warning)' }}>
            {leaveRequests.filter(l => l.status === 'Pending').length}
          </div>
          <div className="stat-card-subtext">Awaiting Director approval</div>
        </div>
      </div>

      {/* NAVIGATION TABS & VIEW MODE TOGGLE */}
      <div className="responsive-filter-bar">
        {/* Desktop horizontal tabs */}
        <div className="desktop-tabs-container">
          {['employees', 'attendance', 'leave', 'holidays', 'reviews'].map(tabKey => (
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
              {tabKey === 'reviews' ? 'Performance Reviews' : tabKey}
            </button>
          ))}
        </div>

        {/* Mobile Filter Select Dropdown */}
        <select
          className="mobile-filter-select"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
        >
          <option value="employees">Employees Roster</option>
          <option value="attendance">Daily Attendance Logs</option>
          <option value="leave">Leave Applications</option>
          <option value="holidays">Studio Holidays</option>
          <option value="reviews">Performance Reviews</option>
        </select>

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

      {/* TAB 1: EMPLOYEES ROSTER */}
      {activeTab === 'employees' && (
        viewMode === 'card' ? (
          <div className="responsive-cards-grid">
            {employees.map(emp => (
              <div key={emp._id} className="responsive-card-item">
                <div className="responsive-card-header">
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>{emp.employeeCode}</span>
                    <div className="responsive-card-title">{emp.name}</div>
                    <div className="responsive-card-subtitle">{emp.designation} · <span className="badge badge-secondary">{emp.role}</span></div>
                  </div>
                  <span className="badge badge-success">{emp.status}</span>
                </div>

                <div className="responsive-card-body">
                  <div><strong>Email:</strong> {emp.email}</div>
                  <div><strong>Monthly Salary:</strong> ₹{emp.monthlySalary?.toLocaleString('en-IN') || '75,000'}</div>
                </div>

                <div className="responsive-card-footer">
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fecaca', width: '100%', justifyContent: 'center' }}
                    onClick={() => handleDeleteEmployee(emp._id)}
                  >
                    <Trash2 size={14} /> Remove Employee
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
                  <th>CODE</th>
                  <th>EMPLOYEE NAME</th>
                  <th>DESIGNATION</th>
                  <th>SYSTEM ROLE</th>
                  <th>CONTACT EMAIL</th>
                  <th>SALARY (₹)</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp._id}>
                    <td style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{emp.employeeCode}</td>
                    <td style={{ fontWeight: '600' }}>{emp.name}</td>
                    <td>{emp.designation}</td>
                    <td><span className="badge badge-secondary">{emp.role}</span></td>
                    <td>{emp.email}</td>
                    <td>₹{emp.monthlySalary?.toLocaleString('en-IN') || '75,000'}</td>
                    <td><span className="badge badge-success">{emp.status}</span></td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fecaca' }}
                        onClick={() => handleDeleteEmployee(emp._id)}
                        title="Delete Employee Record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* TAB 2: ATTENDANCE LOGS */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <ClockInOutWidget variant="card" onStatusChange={loadHrmData} />
          <div className="table-responsive">
            <table className="table">
            <thead>
              <tr>
                <th>EMPLOYEE</th>
                <th>DATE</th>
                <th>CHECK IN</th>
                <th>CHECK OUT</th>
                <th>WORK HOURS</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {attendanceLogs.map(att => (
                <tr key={att._id}>
                  <td style={{ fontWeight: '600' }}>{att.employee?.name}</td>
                  <td>{att.date}</td>
                  <td>{att.checkIn || '--'}</td>
                  <td>{att.checkOut || '--'}</td>
                  <td>{att.workHours ? `${att.workHours} hrs` : '--'}</td>
                  <td>
                    <span className={`badge ${att.status === 'Present' ? 'badge-success' : 'badge-warning'}`}>
                      {att.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* TAB 3: LEAVE REQUESTS */}
      {activeTab === 'leave' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>EMPLOYEE</th>
                <th>LEAVE TYPE</th>
                <th>START DATE</th>
                <th>END DATE</th>
                <th>REASON</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.map(l => (
                <tr key={l._id}>
                  <td style={{ fontWeight: '600' }}>{l.employee?.name}</td>
                  <td>{l.leaveType}</td>
                  <td>{formatDate(l.startDate)}</td>
                  <td>{formatDate(l.endDate)}</td>
                  <td>{l.reason}</td>
                  <td>
                    <span className={`badge ${l.status === 'Approved' ? 'badge-success' : l.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td>
                    {l.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', color: 'var(--color-success)' }} onClick={() => handleLeaveStatus(l._id, 'Approved')}>
                          <CheckCircle2 size={14} /> Approve
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', color: 'var(--color-danger)' }} onClick={() => handleLeaveStatus(l._id, 'Rejected')}>
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: HOLIDAYS */}
      {activeTab === 'holidays' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>HOLIDAY NAME</th>
                <th>DATE</th>
                <th>CATEGORY</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map(h => (
                <tr key={h._id}>
                  <td style={{ fontWeight: '600' }}>{h.holidayName}</td>
                  <td>{h.date}</td>
                  <td><span className="badge badge-secondary">{h.type || 'Holiday'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: PERFORMANCE REVIEWS */}
      {activeTab === 'reviews' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>EMPLOYEE</th>
                <th>PERIOD</th>
                <th>QUALITY</th>
                <th>TIMELINESS</th>
                <th>TEAMWORK</th>
                <th>OVERALL SCORE</th>
                <th>FEEDBACK</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map(r => (
                <tr key={r._id}>
                  <td style={{ fontWeight: '600' }}>{r.employee?.name}</td>
                  <td>{r.reviewPeriod}</td>
                  <td>{r.qualityScore} / 10</td>
                  <td>{r.timelinessScore} / 10</td>
                  <td>{r.teamworkScore} / 10</td>
                  <td style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{r.blendedOverallScore} / 10</td>
                  <td>{r.feedback}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ONBOARD EMPLOYEE MODAL */}
      {isEmployeeModalOpen && (
        <Modal isOpen={isEmployeeModalOpen} title="Onboard New Staff Member" onClose={() => setIsEmployeeModalOpen(false)}>
          <form onSubmit={handleAddEmployee}>
            <FormField label="Full Name" name="name" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} required />
            <FormField label="Email Address" name="email" type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} required />
            <FormField label="Designation Title" name="designation" value={empForm.designation} onChange={e => setEmpForm({ ...empForm, designation: e.target.value })} placeholder="3D Lighting Artist" required />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormField label="System Role" name="role" type="select" value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })}>
                <option value="Artist">Artist</option>
                <option value="Production Manager">Production Manager</option>
                <option value="Human Resource">Human Resource</option>
                <option value="Business Development Manager">Business Development Manager</option>
              </FormField>
              <FormField label="Monthly Salary (₹)" name="monthlySalary" type="number" value={empForm.monthlySalary} onChange={e => setEmpForm({ ...empForm, monthlySalary: e.target.value })} placeholder="75000" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsEmployeeModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Onboard Employee</button>
            </div>
          </form>
        </Modal>
      )}

      {/* APPLY LEAVE MODAL */}
      {isLeaveModalOpen && (
        <Modal isOpen={isLeaveModalOpen} title="Apply Staff Leave Application" onClose={() => setIsLeaveModalOpen(false)}>
          <form onSubmit={handleApplyLeave}>
            <FormField label="Employee" name="employeeId" type="select" value={leaveForm.employeeId} onChange={e => setLeaveForm({ ...leaveForm, employeeId: e.target.value })} required>
              <option value="">-- Choose Employee --</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp._id}>{emp.name} ({emp.employeeCode})</option>
              ))}
            </FormField>

            <FormField label="Leave Type" name="leaveType" type="select" value={leaveForm.leaveType} onChange={e => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}>
              <option value="Casual Leave">Casual Leave</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Privilege Leave">Privilege Leave</option>
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormField label="Start Date" name="startDate" type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required />
              <FormField label="End Date" name="endDate" type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} required />
            </div>

            <FormField label="Reason for Leave" name="reason" type="textarea" value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} required />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsLeaveModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Submit Application</button>
            </div>
          </form>
        </Modal>
      )}

      {/* APPRAISAL REVIEW MODAL */}
      {isReviewModalOpen && (
        <Modal isOpen={isReviewModalOpen} title="Record Performance Review" onClose={() => setIsReviewModalOpen(false)}>
          <form onSubmit={handleAddReview}>
            <FormField label="Employee" name="employeeId" type="select" value={reviewForm.employeeId} onChange={e => setReviewForm({ ...reviewForm, employeeId: e.target.value })} required>
              <option value="">-- Select Employee --</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp._id}>{emp.name}</option>
              ))}
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <FormField label="Quality (1-10)" name="qualityScore" type="number" min="1" max="10" value={reviewForm.qualityScore} onChange={e => setReviewForm({ ...reviewForm, qualityScore: e.target.value })} required />
              <FormField label="Timeliness (1-10)" name="timelinessScore" type="number" min="1" max="10" value={reviewForm.timelinessScore} onChange={e => setReviewForm({ ...reviewForm, timelinessScore: e.target.value })} required />
              <FormField label="Teamwork (1-10)" name="teamworkScore" type="number" min="1" max="10" value={reviewForm.teamworkScore} onChange={e => setReviewForm({ ...reviewForm, teamworkScore: e.target.value })} required />
            </div>

            <FormField label="Manager Feedback & Comments" name="feedback" type="textarea" value={reviewForm.feedback} onChange={e => setReviewForm({ ...reviewForm, feedback: e.target.value })} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsReviewModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Review</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
