import { attendanceService } from '../services/attendanceService';
import React, { useState, useEffect } from 'react';
import { timelineService } from '../services/timelineService';
import { hrService } from '../services/hrService';
import { projectService } from '../services/projectService';
import { authService } from '../services/authService';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, Tag, User, MapPin, CheckCircle, Video, Flag, AlertTriangle } from 'lucide-react';
import './Dashboard.css';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EVENT_TYPES = ['All', 'Reminder', 'Task', 'Milestone', 'Meeting', 'Leave', 'Holiday'];

export const StudioCalendar = () => {
  const currentUser = authService.getCurrentUser();
  const currentUserId = currentUser?._id || currentUser?.id;
  const currentUserName = typeof currentUser?.name === 'string'
    ? currentUser.name
    : (currentUser?.name?.name || currentUser?.email || '');
  const userRoleName = typeof currentUser?.role === 'object'
    ? (currentUser?.role?.name || 'Artist')
    : (currentUser?.role || 'Artist');
  const isDirector = userRoleName.toLowerCase() === 'director';
  const roleNameLower = userRoleName.toLowerCase();
  const isManagement = isDirector || roleNameLower.includes('manager') || roleNameLower.includes('pm') || roleNameLower.includes('production');
  const isArtistRole = !isManagement;
  const visibleEventTypes = isArtistRole ? ['All', 'Leave', 'Holiday'] : EVENT_TYPES;

  const [artistAttendanceMap, setArtistAttendanceMap] = useState({});

  useEffect(() => {
    if (isArtistRole && currentUserId) {
      attendanceService.getEmployeeAttendance(currentUserId).then(res => {
        const attList = Array.isArray(res) ? res : (res?.attendance || res?.records || []);
        const map = {};
        attList.forEach(a => {
          if (a.date) {
            const dStr = new Date(a.date).toISOString().split('T')[0];
            const inTime = a.checkInFormatted || (a.checkIn ? new Date(a.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);
            const outTime = a.checkOutFormatted || (a.checkOut ? new Date(a.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);
            map[dStr] = { inTime, outTime, status: a.status || 'Present' };
          }
        });
        setArtistAttendanceMap(map);
      }).catch(() => setArtistAttendanceMap({}));
    }
  }, [isArtistRole, currentUserId]);


  const today = new Date();
  const todayDateStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

  const [currentDate, setCurrentDate] = useState(new Date()); // Live today date
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day'
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);

  const [newEvent, setNewEvent] = useState({
    title: '',
    date: todayDateStr,
    type: 'Milestone',
    project: 'Studio Master Project',
    time: '10:30 AM',
    assignedTo: 'Arjun Mehta'
  });

  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchCalendarEvents();
  }, [currentDate]);

  const formatEventDateStr = (rawDate) => {
    if (!rawDate) return '';
    if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return String(rawDate).slice(0, 10);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  const parseLocalDateStr = (rawDate) => {
    if (!rawDate) return null;
    if (rawDate instanceof Date) {
      return new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate());
    }
    const str = String(rawDate).trim();
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(str)) {
      const parts = str.split(/[\/\-]/);
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(str)) {
      const parts = str.split('T')[0].split(/[\/\-]/);
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const fetchCalendarEvents = async () => {
    setLoading(true);
    try {
      const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;

      const [data, holidayList, leaveList, projectList] = await Promise.all([
        timelineService.getStudioCalendar({ view: viewMode, date: dateStr }).catch(() => null),
        hrService.getHolidays().catch(() => []),
        hrService.getLeaveRequests().catch(() => []),
        projectService.getProjects().catch(() => [])
      ]);

      let fetched = [];
      if (Array.isArray(data)) {
        fetched = data;
      } else if (data && Array.isArray(data.events)) {
        fetched = data.events;
      }

      fetched = fetched.map(e => ({
        ...e,
        dateStr: formatEventDateStr(e.dateStr || e.date || e.startDate),
        date: formatEventDateStr(e.date || e.dateStr || e.startDate)
      }));

      // 1. Holiday Calendar Events
      const holidayEvents = (holidayList || []).map(h => {
        const dStr = formatEventDateStr(h.date || h.dateStr);
        return {
          id: `hol_${h._id || h.id}`,
          title: `Holiday: ${h.name || h.holidayName}`,
          date: dStr,
          dateStr: dStr,
          type: 'Holiday',
          category: h.type || h.category || 'Festival',
          project: 'Studio Holiday',
          time: 'All Day',
          assignedTo: 'All Staff'
        };
      });

      // 2. Expand leaves for every single day in the leave range
      const leaveEvents = [];
      (leaveList || []).forEach(l => {
        if (['Approved', 'Pending'].includes(l.status)) {
          const empName = typeof l.employee === 'object' ? (l.employee?.name || l.employee?.email) : (l.employee || 'Staff');
          const empId = typeof l.employee === 'object' ? (l.employee?._id || '') : (l.employee || '');

          const startD = parseLocalDateStr(l.fromDate || l.fromDateFormatted || l.startDate);
          const endD = parseLocalDateStr(l.toDate || l.toDateFormatted || l.endDate) || startD;

          if (startD) {
            const cur = new Date(startD);
            const stop = endD ? new Date(endD) : new Date(startD);

            while (cur <= stop) {
              const dStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
              leaveEvents.push({
                id: `leave_${l._id || l.id}_${dStr}`,
                title: `Leave: ${empName} (${l.leaveType || 'Leave'})`,
                date: dStr,
                dateStr: dStr,
                type: 'Leave',
                project: 'HR Leave',
                time: 'All Day',
                assignedTo: empName,
                assignedId: empId
              });
              cur.setDate(cur.getDate() + 1);
            }
          }
        }
      });

      // 3. Project Start, End & 2-Day Prior Reminder Events
      const projectEvents = [];
      const extractedProjects = Array.isArray(projectList) ? projectList : (projectList?.projects || projectList?.data || []);

      extractedProjects.forEach(p => {
        const pName = p.projectName || p.name || 'Project';
        const pmName = typeof p.productionManager === 'object' ? (p.productionManager?.name || 'PM Lead') : (p.productionManager || 'PM Lead');

        // Project Start Date Event
        if (p.startDate) {
          const sDateStr = formatEventDateStr(p.startDate);
          projectEvents.push({
            id: `proj_start_${p._id}`,
            title: `🚀 Project Start: ${pName}`,
            date: sDateStr,
            dateStr: sDateStr,
            type: 'Project Start',
            project: pName,
            time: 'Kickoff',
            assignedTo: pmName
          });

          // 2-Day Prior Start Reminder Event
          const sDateObj = parseLocalDateStr(p.startDate);
          if (sDateObj) {
            const remDate = new Date(sDateObj);
            remDate.setDate(remDate.getDate() - 2);
            const remDateStr = `${remDate.getFullYear()}-${String(remDate.getMonth() + 1).padStart(2, '0')}-${String(remDate.getDate()).padStart(2, '0')}`;
            projectEvents.push({
              id: `proj_start_rem_${p._id}`,
              title: `⏰ 2-Day Reminder: "${pName}" Starts Soon`,
              date: remDateStr,
              dateStr: remDateStr,
              type: 'Reminder',
              project: pName,
              time: '2-Day Alert',
              assignedTo: pmName
            });
          }
        }

        // Project End Date Event
        if (p.endDate) {
          const eDateStr = formatEventDateStr(p.endDate);
          projectEvents.push({
            id: `proj_end_${p._id}`,
            title: `🏁 Project End: ${pName}`,
            date: eDateStr,
            dateStr: eDateStr,
            type: 'Project End',
            project: pName,
            time: 'Deadline',
            assignedTo: pmName
          });

          // 2-Day Prior End/Deadline Reminder Event
          const eDateObj = parseLocalDateStr(p.endDate);
          if (eDateObj) {
            const remDate = new Date(eDateObj);
            remDate.setDate(remDate.getDate() - 2);
            const remDateStr = `${remDate.getFullYear()}-${String(remDate.getMonth() + 1).padStart(2, '0')}-${String(remDate.getDate()).padStart(2, '0')}`;
            projectEvents.push({
              id: `proj_end_rem_${p._id}`,
              title: `⏰ 2-Day Reminder: "${pName}" Deadline in 2 Days`,
              date: remDateStr,
              dateStr: remDateStr,
              type: 'Reminder',
              project: pName,
              time: '2-Day Alert',
              assignedTo: pmName
            });
          }
        }
      });

      const combined = [...fetched, ...holidayEvents, ...leaveEvents, ...projectEvents];
      const uniqueEventsMap = new Map();
      combined.forEach(item => {
        const key = item.id ? String(item.id) : `${item.type}_${item.title}_${item.dateStr}`;
        if (!uniqueEventsMap.has(key)) {
          uniqueEventsMap.set(key, item);
        }
      });

      setEvents(Array.from(uniqueEventsMap.values()));
    } catch (err) {
      setToast({ message: err.message || 'Failed to load calendar events', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // LIVE NAVIGATION HANDLERS
  const handlePrev = () => {
    const nextDate = new Date(currentDate);
    if (viewMode === 'month') {
      nextDate.setMonth(nextDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      nextDate.setDate(nextDate.getDate() - 7);
    } else {
      nextDate.setDate(nextDate.getDate() - 1);
    }
    setCurrentDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(currentDate);
    if (viewMode === 'month') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    setCurrentDate(nextDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleCreateEvent = (e) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;

    const item = {
      id: `evt_${Date.now()}`,
      ...newEvent
    };

    setEvents([item, ...events]);
    setToast({ message: 'New event added to studio calendar!', type: 'success' });
    setIsAddEventModalOpen(false);
    setNewEvent({ title: '', date: new Date().toISOString().split('T')[0], type: 'Milestone', project: 'Studio Master Project', time: '10:30 AM', assignedTo: 'Arjun Mehta' });
  };

  // Helper to generate full month calendar days
  const getCalendarDays = () => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const firstDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    const totalDaysInMonth = lastDay.getDate();

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days = [];

    // Trailing days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${(prevMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({ dayNumber: d, isCurrentMonth: false, dateStr });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({ dayNumber: d, isCurrentMonth: true, dateStr });
    }

    // Leading days for next month
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${(nextMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({ dayNumber: d, isCurrentMonth: false, dateStr });
    }

    return days;
  };

  // Helper to get week days for 'week' view
  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      days.push({ dayName: DAYS_OF_WEEK[i], dayNumber: d.getDate(), monthName: d.toLocaleString('default', { month: 'short' }), dateStr });
    }
    return days;
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'Project Start':
        return { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd', icon: Flag };
      case 'Project End':
        return { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', icon: CheckCircle };
      case 'Reminder':
        return { bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', icon: Clock };
      case 'Milestone':
        return { bg: '#fbf7f0', color: '#B68D40', border: '#e9e0d1', icon: Flag };
      case 'Task':
      case 'Delivery':
        return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: CheckCircle };
      case 'Meeting':
        return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: Video };
      case 'Followup':
        return { bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', icon: Clock };
      case 'Leave':
        return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', icon: User };
      case 'Holiday':
        return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: Flag };
      default:
        return { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff', icon: Tag };
    }
  };

  const calendarDays = getCalendarDays();
  const weekDays = getWeekDays();

  // Filter events by selected type AND user role assignment
  const filteredEvents = events.filter(e => {
    // Remove Project Start and Project End events studio-wide as requested
    if (e.type === 'Project Start' || e.type === 'Project End') return false;
    const matchesType = selectedTypeFilter === 'All' || e.type === selectedTypeFilter;
    if (!matchesType) return false;

    if (isDirector) return true;
    if (e.type === 'Holiday' || e.type === 'Leave' || e.type === 'Project Start' || e.type === 'Project End' || e.type === 'Reminder') return true;

    const assigned = e.assignedTo || e.assignee || e.user;
    if (!assigned) return true;

    const assignedStr = typeof assigned === 'object' ? (assigned.name || assigned._id || '') : String(assigned);
    return assignedStr.toLowerCase().includes(currentUserName.toLowerCase()) || assignedStr === currentUserId;
  });

  const selectedDayStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
  const dayViewEvents = filteredEvents.filter(e => e.date === selectedDayStr);

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Hero Header */}
      <div className="page-header-responsive">
        <div className="page-header-title-block">
          <h1 className="hero-serif-title">Studio Master Calendar</h1>
          <p className="hero-sub-summary">Studio-wide aggregated schedule, milestone deliveries, client pitches and rendering deadlines</p>
        </div>
      </div>

      {loading ? (
        <Loader text="Generating studio calendar schedule..." />
      ) : (
        <div className="team-widget-card" style={{ padding: '1.5rem', backgroundColor: '#ffffff', overflowX: 'auto' }}>
          {/* Controls Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.1rem', fontWeight: 800, color: '#1F1F1F', margin: 0, letterSpacing: '-0.02em' }}>
                {monthName} {year}
              </h2>
              <button
                onClick={handleToday}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontWeight: 700 }}
              >
                Today
              </button>

              <div style={{ display: 'flex', gap: '0.25rem', border: '1px solid #dcd8cf', borderRadius: '10px', padding: '2px', backgroundColor: '#faf9f6' }}>
                <button
                  onClick={handlePrev}
                  style={{ width: '32px', height: '30px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Previous"
                >
                  <ChevronLeft size={18} color="#1F1F1F" />
                </button>
                <button
                  onClick={handleNext}
                  style={{ width: '32px', height: '30px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Next"
                >
                  <ChevronRight size={18} color="#1F1F1F" />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
              {/* Type Filter Pills */}
              <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: '#faf9f6', padding: '3px', borderRadius: '10px', border: '1px solid #eeeae3', flexWrap: 'wrap' }}>
                {visibleEventTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedTypeFilter(type)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: selectedTypeFilter === type ? '#1F1F1F' : 'transparent',
                      color: selectedTypeFilter === type ? '#ffffff' : '#78746d'
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* View Mode Selector */}
              <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#faf9f6', padding: '3px', borderRadius: '10px', border: '1px solid #eeeae3' }}>
                {['month', 'week', 'day'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      backgroundColor: viewMode === mode ? '#B68D40' : 'transparent',
                      color: viewMode === mode ? '#ffffff' : '#78746d'
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* MONTH VIEW GRID */}
          {viewMode === 'month' && (
            <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e9e5dc', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
              {/* Days Header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', backgroundColor: '#f5f2eb', borderBottom: '1px solid #e9e5dc' }}>
                {DAYS_OF_WEEK.map((d, idx) => (
                  <div key={d} style={{ padding: '0.75rem 0.25rem', textAlign: 'center', fontWeight: 800, fontSize: '0.8rem', color: idx === 0 || idx === 6 ? '#b45309' : '#1F1F1F', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Month Grid Cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', backgroundColor: '#e9e5dc', gap: '1px' }}>
                {calendarDays.map((cell, idx) => {
                  const dayEvents = filteredEvents.filter(e => e.date === cell.dateStr);
                  const isToday = cell.dateStr === todayDateStr;
                  const cellDate = cell.dateStr ? new Date(cell.dateStr) : null;
                  const isSunday = cellDate && !isNaN(cellDate.getTime()) && cellDate.getDay() === 0;
                  const isHoliday = dayEvents.some(e =>
                    e.type === 'Holiday' ||
                    e.eventType === 'holiday' ||
                    e.category === 'holiday' ||
                    (e.title && e.title.toLowerCase().includes('holiday'))
                  );
                  const isRedDay = isSunday || isHoliday;
                  const displayEvents = dayEvents.slice(0, 3);
                  const extraCount = dayEvents.length - 3;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDayDetails({ dateStr: cell.dateStr, events: dayEvents })}
                      style={{
                        backgroundColor: isRedDay
                          ? (isToday ? '#fee2e2' : '#fef2f2')
                          : (cell.isCurrentMonth ? (isToday ? '#fffbf5' : '#ffffff') : '#fbfaf8'),
                        height: isMobile ? '64px' : '140px',
                        minHeight: isMobile ? '64px' : '140px',
                        padding: isMobile ? '0.25rem' : '0.45rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        overflowY: 'auto',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        transition: 'backgroundColor 150ms ease'
                      }}
                    >
                      {/* Cell Day Number Header */}
                      <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.25rem', flexShrink: 0 }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: isMobile ? '0.8rem' : '0.85rem',
                            width: isMobile ? '22px' : '24px',
                            height: isMobile ? '22px' : '24px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isToday ? '#B68D40' : (isRedDay ? '#fee2e2' : 'transparent'),
                            color: isToday ? '#ffffff' : (isRedDay ? '#dc2626' : (cell.isCurrentMonth ? '#1F1F1F' : '#b0aaa0'))
                          }}
                        >
                          {cell.dayNumber}
                        </span>

                        {!isMobile && (isRedDay || dayEvents.length > 0) && (
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: isRedDay ? '#dc2626' : '#8c8882' }}>
                            {isHoliday ? '🏖️ Holiday' : (isSunday ? 'Weekly Off' : `${dayEvents.length} item${dayEvents.length > 1 ? 's' : ''}`)}
                          </span>
                        )}
                      </div>

                      {/* Mobile Dots */}
                      {isMobile && dayEvents.length > 0 && (
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                          {dayEvents.slice(0, 3).map((_, dIdx) => (
                            <div key={dIdx} style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#B68D40' }} />
                          ))}
                        </div>
                      )}

                      {/* Desktop Events List in Day Cell */}
                      {artistAttendanceMap[cell.dateStr] && (
                        <div style={{
                          marginBottom: '4px',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          padding: '2px 5px',
                          borderRadius: '5px',
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          color: '#166534',
                          lineHeight: '1.25'
                        }}>
                          <div>🟢 <b>In:</b> {artistAttendanceMap[cell.dateStr].inTime || '--:--'}</div>
                          {artistAttendanceMap[cell.dateStr].outTime && (
                            <div>🔴 <b>Out:</b> {artistAttendanceMap[cell.dateStr].outTime}</div>
                          )}
                        </div>
                      )}
                      {!isMobile && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                          {displayEvents.map((evt, eIdx) => {
                            const badge = getBadgeStyle(evt.type);
                            const IconComp = badge.icon;

                            return (
                              <div
                                key={evt.id || `evt_${eIdx}`}
                                onClick={(e) => { e.stopPropagation(); setSelectedEvent(evt); }}
                                style={{
                                  backgroundColor: badge.bg,
                                  border: `1px solid ${badge.border}`,
                                  color: badge.color,
                                  borderRadius: '6px',
                                  padding: '0.25rem 0.45rem',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  minWidth: 0
                                }}
                                title={`${evt.title} (${evt.project || ''})`}
                              >
                                <IconComp size={12} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {evt.title}
                                </span>
                              </div>
                            );
                          })}

                          {extraCount > 0 && (
                            <div
                              onClick={(e) => { e.stopPropagation(); setSelectedDayDetails({ dateStr: cell.dateStr, events: dayEvents }); }}
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                color: '#B68D40',
                                padding: '0.15rem 0.35rem',
                                backgroundColor: '#fbf7f0',
                                borderRadius: '4px',
                                textAlign: 'center',
                                marginTop: 'auto'
                              }}
                            >
                              + {extraCount} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {viewMode === 'week' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.75rem' }}>
              {weekDays.map((wDay, idx) => {
                const dayEvents = filteredEvents.filter(e => e.date === wDay.dateStr);
                const isToday = wDay.dateStr === todayDateStr;
                const cellDate = wDay.dateStr ? new Date(wDay.dateStr) : null;
                const isSunday = cellDate && !isNaN(cellDate.getTime()) && cellDate.getDay() === 0;
                const isHoliday = dayEvents.some(e =>
                  e.type === 'Holiday' ||
                  e.eventType === 'holiday' ||
                  e.category === 'holiday' ||
                  (e.title && e.title.toLowerCase().includes('holiday'))
                );
                const isRedDay = isSunday || isHoliday;

                return (
                  <div key={idx} style={{ backgroundColor: isRedDay ? (isToday ? '#fee2e2' : '#fef2f2') : (isToday ? '#fffbf5' : '#ffffff'), border: `1px solid ${isRedDay ? '#fecaca' : (isToday ? '#B68D40' : '#e9e5dc')}`, borderRadius: '14px', padding: '1rem', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ borderBottom: '1px solid #eeeae3', paddingBottom: '0.5rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: isRedDay ? '#dc2626' : '#8c8882', textTransform: 'uppercase' }}>
                        {wDay.dayName} {isRedDay ? (isHoliday ? '(Holiday)' : '(Off)') : ''}
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isToday ? '#B68D40' : (isRedDay ? '#dc2626' : '#1F1F1F') }}>{wDay.dayNumber} {wDay.monthName}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
                      {dayEvents.length === 0 ? (
                        <div style={{ fontSize: '0.75rem', color: '#b0aaa0', textAlign: 'center', fontStyle: 'italic', marginTop: '1rem' }}>No events</div>
                      ) : (
                        dayEvents.map(evt => {
                          const badge = getBadgeStyle(evt.type);
                          const IconComp = badge.icon;

                          return (
                            <div
                              key={evt.id}
                              onClick={() => setSelectedEvent(evt)}
                              style={{ backgroundColor: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, borderRadius: '8px', padding: '0.5rem', cursor: 'pointer' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, fontSize: '0.78rem' }}>
                                <IconComp size={14} />
                                {evt.title}
                              </div>
                              {evt.project && <div style={{ fontSize: '0.7rem', color: '#525252', marginTop: '0.15rem' }}>{evt.project}</div>}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* DAY VIEW */}
          {viewMode === 'day' && (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e9e5dc', borderRadius: '14px', padding: '1.5rem' }}>
              <div style={{ borderBottom: '1px solid #eeeae3', paddingBottom: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1F1F1F', margin: 0 }}>
                    Schedule for {selectedDayStr}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#8c8882' }}>{dayViewEvents.length} events scheduled</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {dayViewEvents.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#8c8882', fontStyle: 'italic' }}>
                    No calendar events scheduled for this date.
                  </div>
                ) : (
                  dayViewEvents.map(evt => {
                    const badge = getBadgeStyle(evt.type);
                    const IconComp = badge.icon;

                    return (
                      <div
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        style={{ backgroundColor: badge.bg, border: `1px solid ${badge.border}`, borderRadius: '12px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconComp size={18} color={badge.color} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1F1F1F' }}>{evt.title}</div>
                            <div style={{ fontSize: '0.78rem', color: '#525252', marginTop: '0.1rem' }}>Project: {evt.project} · Assigned: {evt.assignedTo || 'Team'}</div>
                          </div>
                        </div>

                        <span style={{ fontWeight: 800, fontSize: '0.8rem', color: badge.color }}>
                          {evt.time || 'All Day'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DAY DETAILS POPUP MODAL */}
      {selectedDayDetails && (
        <Modal
          isOpen={Boolean(selectedDayDetails)}
          onClose={() => setSelectedDayDetails(null)}
          title={`All Events — ${selectedDayDetails.dateStr}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {selectedDayDetails.events.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#8c8882', fontStyle: 'italic' }}>
                No events recorded for this date.
              </div>
            ) : (
              selectedDayDetails.events.map(evt => {
                const badge = getBadgeStyle(evt.type);
                const IconComp = badge.icon;

                return (
                  <div
                    key={evt.id}
                    onClick={() => { setSelectedEvent(evt); setSelectedDayDetails(null); }}
                    style={{ backgroundColor: badge.bg, border: `1px solid ${badge.border}`, borderRadius: '10px', padding: '0.85rem', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.85rem', color: badge.color }}>
                      <IconComp size={16} />
                      {evt.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#525252', marginTop: '0.25rem' }}>
                      Project: {evt.project} · Assigned: {evt.assignedTo || 'Team'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Modal>
      )}

      {/* EVENT DETAILS MODAL */}
      {selectedEvent && (
        <Modal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          title={selectedEvent.title}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="task-status-blue">{selectedEvent.type}</span>
              <span style={{ fontSize: '0.85rem', color: '#8c8882', fontWeight: 600 }}>{selectedEvent.dateStr}</span>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8c8882', textTransform: 'uppercase' }}>Project</label>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F1F1F' }}>{selectedEvent.project}</div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8c8882', textTransform: 'uppercase' }}>Assigned To</label>
              <div style={{ fontSize: '0.9rem', color: '#1F1F1F' }}>{selectedEvent.assignedTo || 'All Staff'}</div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
