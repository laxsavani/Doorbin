import React, { useState, useEffect } from 'react';
import { hrService } from '../services/hrService';
import { authService } from '../services/authService';
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

  // Extract Logged-in User Session Token Info
  const currentUser = authService.getCurrentUser();
  const currentUserId = currentUser?._id || currentUser?.id;
  const currentUserName = typeof currentUser?.name === 'string'
    ? currentUser.name
    : (currentUser?.name?.name || currentUser?.email || 'Logged User');
  const userRoleName = typeof currentUser?.role === 'object'
    ? (currentUser?.role?.name || 'Artist')
    : (currentUser?.role || 'Artist');

  const isDirectorOrHR = userRoleName.toLowerCase() === 'director' || userRoleName.toLowerCase() === 'human resource';

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

  // Export Attendance State
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [exportEmployeeId, setExportEmployeeId] = useState('all');

  const handleExportAttendance = async (format) => {
    try {
      setToast({ message: `Generating month-wise ${format.toUpperCase()} attendance report...`, type: 'info' });
      const params = {
        format,
        month: exportMonth
      };
      if (exportEmployeeId && exportEmployeeId !== 'all') {
        params.employeeId = exportEmployeeId;
      }

      const response = await hrService.exportAttendanceReport(params);

      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : (format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Attendance_Report_${exportMonth}_${format}.${format === 'excel' ? 'xlsx' : format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setToast({ message: `Month-wise attendance ${format.toUpperCase()} report downloaded successfully!`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to download month-wise attendance report', type: 'error' });
    }
  };

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

  // Apply Leave Handler (Auto-extracts logged user ID from token)
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.startDate || !leaveForm.endDate) {
      setToast({ message: 'Please fill in leave start and end dates', type: 'error' });
      return;
    }

    try {
      const targetEmpId = isDirectorOrHR ? (leaveForm.employeeId || currentUserId) : currentUserId;
      const selectedEmp = employees.find(emp => emp._id === targetEmpId || emp.userId === targetEmpId) || {
        _id: targetEmpId,
        name: currentUserName,
        employeeCode: 'EMP-SELF'
      };

      const newLeave = await hrService.applyLeave({
        leaveType: leaveForm.leaveType,
        fromDate: leaveForm.startDate,
        toDate: leaveForm.endDate,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason
      });

      const updatedLeaves = await hrService.getLeaveRequests();
      setLeaveRequests(updatedLeaves.length > 0 ? updatedLeaves : [newLeave]);
      setIsLeaveModalOpen(false);
      setToast({ message: 'Leave application submitted successfully!', type: 'success' });
      setLeaveForm({ employeeId: '', leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to apply leave', type: 'error' });
    }
  };

  // Approve / Reject Leave Handler
  const handleLeaveStatus = async (id, status) => {
    try {
      await hrService.updateLeaveStatus(id, { decision: status, status });
      const updatedLeaves = await hrService.getLeaveRequests();
      if (updatedLeaves.length > 0) {
        setLeaveRequests(updatedLeaves);
      } else {
        setLeaveRequests(prev => prev.map(l => l._id === id ? { ...l, status } : l));
      }
      setToast({ message: `Leave application ${status.toLowerCase()}!`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to update leave status', type: 'error' });
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

  const formatISTTimeStr = (val) => {
    if (!val) return '--:--';
    if (typeof val === 'string') {
      const s = val.trim();
      if (s === 'Invalid Date' || !s) return '--:--';
      if (/^\d{1,2}:\d{2}\s*(AM|PM|am|pm)$/i.test(s)) return s;
      if (/^\d{1,2}:\d{2}$/.test(s)) {
        const [h, m] = s.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        return `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
      }
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return (typeof val === 'string' && val.trim() && val !== 'Invalid Date') ? val : '--:--';
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const parseTimeToMinutes = (timeVal) => {
    if (!timeVal) return null;
    if (typeof timeVal === 'string') {
      const s = timeVal.trim();
      const match = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const ampm = match[3] ? match[3].toUpperCase() : null;

        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        return hours * 60 + minutes;
      }
    }

    const d = new Date(timeVal);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }

    return null;
  };

  const formatWorkedDuration = (checkInVal, checkOutVal, workingHoursNum) => {
    let totalMinutes = 0;

    const startMins = parseTimeToMinutes(checkInVal);
    const endMins = parseTimeToMinutes(checkOutVal);

    if (startMins !== null && endMins !== null && endMins >= startMins) {
      totalMinutes = endMins - startMins;
    } else if (checkInVal && checkOutVal) {
      const startMs = new Date(checkInVal).getTime();
      const endMs = new Date(checkOutVal).getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
        totalMinutes = Math.floor((endMs - startMs) / (1000 * 60));
      }
    }

    if (totalMinutes === 0 && workingHoursNum && !isNaN(workingHoursNum) && Number(workingHoursNum) > 0) {
      totalMinutes = Math.round(Number(workingHoursNum) * 60);
    }

    if (totalMinutes <= 0) return '00h 00m';

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    const hStr = h.toString().padStart(2, '0');
    const mStr = m.toString().padStart(2, '0');

    return `${hStr}h ${mStr}m`;
  };

  const renderAttendanceTab = () => (
    <div>
      {/* Month-Wise Export & Filter Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #e9e5dc', borderRadius: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: '#8c8882', marginBottom: '0.25rem' }}>SELECT MONTH</label>
            <input
              type="month"
              value={exportMonth}
              onChange={(e) => setExportMonth(e.target.value)}
              style={{ padding: '0.45rem 0.65rem', border: '1px solid #dcd7ce', borderRadius: '6px', fontSize: '0.825rem', color: '#1F1F1F' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: '#8c8882', marginBottom: '0.25rem' }}>FILTER EMPLOYEE</label>
            <select
              value={exportEmployeeId}
              onChange={(e) => setExportEmployeeId(e.target.value)}
              style={{ padding: '0.45rem 0.65rem', border: '1px solid #dcd7ce', borderRadius: '6px', fontSize: '0.825rem', color: '#1F1F1F', backgroundColor: '#ffffff' }}
            >
              <option value="all">All Staff Members (Monthly Summary)</option>
              {employees.map(e => (
                <option key={e._id || e.id} value={e.user?._id || e._id || e.id}>
                  {e.name || e.user?.name || 'Staff Member'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => handleExportAttendance('pdf')}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}
          >
            📄 PDF Report
          </button>
          <button
            onClick={() => handleExportAttendance('excel')}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}
          >
            📊 Excel (.xlsx)
          </button>
          <button
            onClick={() => handleExportAttendance('csv')}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}
          >
            📑 CSV Export
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>EMPLOYEE</th>
              <th>DATE</th>
              <th>CLOCK IN</th>
              <th>CLOCK OUT</th>
              <th>HOURS WORKED</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
              {attendanceLogs.map(att => {
                const isLeaveDay = att.status === 'On Leave' || att.status === 'Leave';
                const checkInStr = isLeaveDay ? '--' : (att.checkIn ? formatISTTimeStr(att.checkIn) : (att.activeSession?.checkInFormatted || '--'));
                const checkOutStr = isLeaveDay ? '--' : (att.checkOut ? formatISTTimeStr(att.checkOut) : (att.activeSession?.checkOutFormatted || '--'));
                
                let displayDate = 'Today';
                if (att.dateFormatted && att.dateFormatted !== 'Invalid Date') {
                  displayDate = att.dateFormatted;
                } else if (att.date) {
                  if (typeof att.date === 'string' && att.date.includes('/')) {
                    displayDate = att.date;
                  } else {
                    const parsedD = new Date(att.date);
                    displayDate = isNaN(parsedD.getTime()) ? (typeof att.date === 'string' ? att.date : 'Today') : parsedD.toLocaleDateString('en-GB');
                  }
                }

                return (
                  <tr key={att._id}>
                    <td style={{ fontWeight: '600' }}>{att.employee?.name || currentUserName}</td>
                    <td style={{ fontWeight: '600' }}>{displayDate}</td>
                    <td>{checkInStr}</td>
                    <td>{checkOutStr}</td>
                    <td style={{ fontWeight: '600', color: isLeaveDay ? '#94a3b8' : 'var(--color-primary)' }}>
                      {isLeaveDay ? '--' : formatWorkedDuration(checkInStr, checkOutStr, att.workingHours)}
                    </td>
                    <td>
                      <span className={`badge ${att.status === 'Present' ? 'badge-success' : (att.status === 'On Leave' || att.status === 'Leave' ? 'badge-info' : att.status === 'Late' ? 'badge-warning' : 'badge-danger')}`}>
                        {att.status || 'Present'}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );

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
          {isDirectorOrHR && (
            <>
              <button className="btn btn-secondary" onClick={() => setIsReviewModalOpen(true)}>
                <Award size={16} /> Performance Appraisal
              </button>
              <button className="btn btn-primary" onClick={() => setIsEmployeeModalOpen(true)}>
                <Plus size={16} /> Onboard Staff
              </button>
            </>
          )}
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
          {['employees', 'attendance', 'leave', 'holidays', 'reviews'].map(tabKey => {
            const pendingLeavesCount = leaveRequests.filter(l => l.status === 'Pending').length;
            return (
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
                  textTransform: 'capitalize',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                {tabKey === 'reviews' ? 'Performance Reviews' : (tabKey === 'leave' ? 'Leave' : tabKey)}
                {tabKey === 'leave' && (
                  <span style={{
                    backgroundColor: pendingLeavesCount > 0 ? '#f59e0b' : '#e5e7eb',
                    color: pendingLeavesCount > 0 ? '#ffffff' : '#4b5563',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '9999px',
                    lineHeight: 1
                  }}>
                    {pendingLeavesCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: EMPLOYEES DIRECTORY */}
      {activeTab === 'employees' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>EMPLOYEE</th>
                <th>DESIGNATION</th>
                <th>ROLE</th>
                <th>EMAIL / CONTACT</th>
                <th>STATUS</th>
                {isDirectorOrHR && <th>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp._id}>
                  <td style={{ fontWeight: '600' }}>
                    {emp.name} <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>({emp.employeeCode})</span>
                  </td>
                  <td>{emp.designation}</td>
                  <td><span className="badge badge-secondary">{emp.role}</span></td>
                  <td>{emp.email}</td>
                  <td>
                    <span className={`badge ${emp.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                      {emp.status}
                    </span>
                  </td>
                  {isDirectorOrHR && (
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', color: 'var(--color-danger)' }} onClick={() => handleDeleteEmployee(emp._id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: ATTENDANCE LOGS */}
      {activeTab === 'attendance' && renderAttendanceTab()}

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
                {isDirectorOrHR && <th>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {leaveRequests.map(l => {
                const empName = typeof l.employee === 'object' ? (l.employee?.name || l.employee?.email) : (l.employee || currentUserName);
                const startDateStr = l.fromDateFormatted || l.fromDate || l.startDate;
                const endDateStr = l.toDateFormatted || l.toDate || l.endDate;
                return (
                  <tr key={l._id}>
                    <td style={{ fontWeight: '600' }}>{empName}</td>
                    <td>{l.leaveType}</td>
                    <td>{formatDate(startDateStr)}</td>
                    <td>{formatDate(endDateStr)}</td>
                    <td>{l.reason}</td>
                    <td>
                      <span className={`badge ${l.status === 'Approved' ? 'badge-success' : l.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                        {l.status}
                      </span>
                    </td>
                    {isDirectorOrHR && (
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
                    )}
                  </tr>
                );
              })}
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
            {isDirectorOrHR ? (
              <FormField label="Employee" name="employeeId" type="select" value={leaveForm.employeeId || currentUserId} onChange={e => setLeaveForm({ ...leaveForm, employeeId: e.target.value })} required>
                <option value={currentUserId}>Self — {currentUserName} ({userRoleName})</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.name} ({emp.employeeCode || 'EMP'})</option>
                ))}
              </FormField>
            ) : (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: '#faf9f6', borderRadius: '10px', border: '1px solid #eeeae3' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8c8882', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                  Applicant Employee (Auto-Detected from Token)
                </label>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F1F1F' }}>
                  {currentUserName} <span style={{ fontSize: '0.78rem', color: '#8c8882', fontWeight: 500 }}>({userRoleName})</span>
                </div>
              </div>
            )}

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
