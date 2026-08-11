import React, { useState, useEffect } from 'react';
import { timelineService } from '../services/timelineService';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, Tag, User, MapPin, CheckCircle, Video, Flag } from 'lucide-react';
import './Dashboard.css';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EVENT_TYPES = ['All', 'Milestone', 'Delivery', 'Meeting'];

export const StudioCalendar = () => {
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
    project: 'Hillcrest Luxury Villa',
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

  const fetchCalendarEvents = async () => {
    setLoading(true);
    try {
      const data = await timelineService.getStudioCalendar();
      let fetched = Array.isArray(data) ? data : [];

      const currYear = today.getFullYear();
      const currMonth = (today.getMonth() + 1).toString().padStart(2, '0');

      // Demo studio events for current live month
      const demoEvents = [
        { id: 'cal_1', title: 'Hillcrest Facade 3D Render Review', date: todayDateStr, type: 'Milestone', project: 'Hillcrest Luxury Villa', time: '10:30 AM', assignedTo: 'Sana Qureshi' },
        { id: 'cal_2', title: 'Sun Penthouse Moodboard Pitch', date: `${currYear}-${currMonth}-14`, type: 'Meeting', project: 'Sun Horizon Penthouse', time: '02:00 PM', assignedTo: 'Arjun Mehta' },
        { id: 'cal_3', title: 'Prestige 3D Animatic First Draft', date: `${currYear}-${currMonth}-18`, type: 'Delivery', project: 'Prestige City 3D Animation', time: '05:00 PM', assignedTo: 'Dev Patel' },
        { id: 'cal_4', title: 'Lighting & Shaders Approval Gate', date: `${currYear}-${currMonth}-22`, type: 'Milestone', project: 'Hillcrest Luxury Villa', time: '11:00 AM', assignedTo: 'Arjun Mehta' },
        { id: 'cal_5', title: 'Client VR Walkthrough Session', date: `${currYear}-${currMonth}-25`, type: 'Meeting', project: 'Sun Horizon Penthouse', time: '03:30 PM', assignedTo: 'Tara Nair' },
        { id: 'cal_6', title: '4K Render Farm Sequence Export', date: `${currYear}-${currMonth}-28`, type: 'Delivery', project: 'Prestige City 3D Animation', time: '06:00 PM', assignedTo: 'Dev Patel' }
      ];

      const combined = [...fetched];
      demoEvents.forEach(de => {
        if (!combined.some(e => e.id === de.id)) {
          combined.push(de);
        }
      });

      setEvents(combined);
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
    setCurrentDate(new Date(2026, 7, 10)); // August 10, 2026
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
    setNewEvent({ title: '', date: new Date().toISOString().split('T')[0], type: 'Milestone', project: 'Hillcrest Luxury Villa', time: '10:30 AM', assignedTo: 'Arjun Mehta' });
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
      case 'Milestone':
        return { bg: '#fbf7f0', color: '#B68D40', border: '#e9e0d1', icon: Flag };
      case 'Delivery':
        return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: CheckCircle };
      case 'Meeting':
        return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: Video };
      default:
        return { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff', icon: Tag };
    }
  };

  const calendarDays = getCalendarDays();
  const weekDays = getWeekDays();

  // Filter events by selected type
  const filteredEvents = events.filter(e => selectedTypeFilter === 'All' || e.type === selectedTypeFilter);

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

        <div className="page-header-actions">
          <button onClick={() => setIsAddEventModalOpen(true)} className="btn-new-task">
            <Plus size={16} /> Add Calendar Event
          </button>
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
              <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: '#faf9f6', padding: '3px', borderRadius: '10px', border: '1px solid #eeeae3' }}>
                {EVENT_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedTypeFilter(type)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '0.75rem',
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
                  const displayEvents = dayEvents.slice(0, 2);
                  const extraCount = dayEvents.length - 2;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDayDetails({ dateStr: cell.dateStr, events: dayEvents })}
                      style={{
                        backgroundColor: cell.isCurrentMonth ? (isToday ? '#fffbf5' : '#ffffff') : '#fbfaf8',
                        height: isMobile ? '52px' : '115px',
                        maxHeight: isMobile ? '52px' : '115px',
                        padding: isMobile ? '0.25rem' : '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMobile ? 'center' : 'stretch',
                        justifyContent: isMobile ? 'center' : 'space-between',
                        overflow: 'hidden',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        transition: 'backgroundColor 150ms ease'
                      }}
                    >
                      {/* Cell Day Number Header */}
                      <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'space-between', alignItems: 'center', width: '100%', marginBottom: isMobile ? 0 : '0.25rem' }}>
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
                            backgroundColor: isToday ? '#B68D40' : 'transparent',
                            color: isToday ? '#ffffff' : (cell.isCurrentMonth ? '#1F1F1F' : '#b0aaa0')
                          }}
                        >
                          {cell.dayNumber}
                        </span>

                        {!isMobile && dayEvents.length > 0 && (
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#8c8882' }}>
                            {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Mobile Subtle Dot Indicator */}
                      {isMobile && dayEvents.length > 0 && (
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#B68D40', marginTop: '2px' }} />
                      )}

                      {/* Desktop Events List in Day Cell */}
                      {!isMobile && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflow: 'hidden', flex: 1 }}>
                          {displayEvents.map((evt) => {
                            const badge = getBadgeStyle(evt.type);
                            const IconComp = badge.icon;

                            return (
                              <div
                                key={evt.id}
                                onClick={(e) => { e.stopPropagation(); setSelectedEvent(evt); }}
                                style={{
                                  backgroundColor: badge.bg,
                                  border: `1px solid ${badge.border}`,
                                  color: badge.color,
                                  borderRadius: '6px',
                                  padding: '0.25rem 0.45rem',
                                  fontSize: '0.7rem',
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
                                title={`${evt.title} (${evt.project})`}
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
                              onClick={(e) => { e.stopPropagation(); setSelectedEvent(dayEvents[2]); }}
                              style={{ fontSize: '0.65rem', color: '#8c8882', fontWeight: 700, paddingLeft: '0.25rem' }}
                            >
                              +{extraCount} more
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

          {/* WEEK VIEW BREAKDOWN */}
          {viewMode === 'week' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.85rem' }}>
              {weekDays.map((w) => {
                const dayEvents = filteredEvents.filter(e => e.date === w.dateStr);

                return (
                  <div key={w.dateStr} style={{ backgroundColor: '#faf9f6', border: '1px solid #eeeae3', borderRadius: '14px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', minHeight: '300px' }}>
                    <div style={{ textAlign: 'center', borderBottom: '1px solid #e9e5dc', paddingBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#8c8882' }}>{w.dayName}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1F1F1F' }}>{w.monthName} {w.dayNumber}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                      {dayEvents.length > 0 ? (
                        dayEvents.map(evt => {
                          const badge = getBadgeStyle(evt.type);
                          return (
                            <div key={evt.id} onClick={() => setSelectedEvent(evt)} style={{ backgroundColor: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, borderRadius: '8px', padding: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                              <div>{evt.title}</div>
                              <div style={{ fontSize: '0.68rem', opacity: 0.8, marginTop: '0.2rem' }}>{evt.time}</div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: '#b0aaa0', textAlign: 'center', margin: 'auto' }}>No events</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* DAY VIEW BREAKDOWN */}
          {viewMode === 'day' && (
            <div style={{ backgroundColor: '#faf9f6', border: '1px solid #eeeae3', borderRadius: '14px', padding: '1.5rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1F1F1F', marginBottom: '1rem' }}>
                Agenda for {currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {dayViewEvents.length > 0 ? (
                  dayViewEvents.map(evt => {
                    const badge = getBadgeStyle(evt.type);
                    return (
                      <div key={evt.id} onClick={() => setSelectedEvent(evt)} style={{ backgroundColor: '#ffffff', border: `1px solid ${badge.border}`, borderLeft: `5px solid ${badge.color}`, borderRadius: '10px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                        <div>
                          <span className="task-status-blue" style={{ fontSize: '0.68rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{evt.type}</span>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1F1F1F' }}>{evt.title}</div>
                          <div style={{ fontSize: '0.8rem', color: '#78746d', marginTop: '0.25rem' }}>Project: {evt.project} · Lead: {evt.assignedTo || 'Unassigned'}</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#B68D40', backgroundColor: '#fbf7f0', padding: '0.35rem 0.75rem', borderRadius: '8px' }}>
                          {evt.time || 'All Day'}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#8c8882', fontWeight: 600 }}>
                    No events scheduled for this day. Click "+ Add Calendar Event" to schedule an event.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal for Event Details */}
      {selectedEvent && (
        <Modal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          title={`Studio Event — ${selectedEvent.title}`}
          footer={
            <button className="btn btn-secondary" onClick={() => setSelectedEvent(null)}>Close</button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="task-status-blue" style={{ fontSize: '0.7rem' }}>
                {selectedEvent.type}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1F1F1F' }}>
                Date: {new Date(selectedEvent.date).toLocaleDateString()}
              </span>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#4a4742' }}>
              <strong>Project:</strong> {selectedEvent.project}
            </div>
            {selectedEvent.assignedTo && (
              <div style={{ fontSize: '0.85rem', color: '#4a4742' }}>
                <strong>Assigned Lead:</strong> {selectedEvent.assignedTo}
              </div>
            )}
            {selectedEvent.time && (
              <div style={{ fontSize: '0.85rem', color: '#4a4742' }}>
                <strong>Scheduled Time:</strong> {selectedEvent.time}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Pop-up Modal for Day Details */}
      {selectedDayDetails && (
        <Modal
          isOpen={!!selectedDayDetails}
          onClose={() => setSelectedDayDetails(null)}
          title={`Scheduled Events for ${selectedDayDetails.dateStr}`}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedDayDetails(null)}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setNewEvent({ ...newEvent, date: selectedDayDetails.dateStr });
                  setSelectedDayDetails(null);
                  setIsAddEventModalOpen(true);
                }}
              >
                + Add Event for This Date
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {selectedDayDetails.events.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#78746d' }}>
                No studio events scheduled for this day. Click below to add one!
              </div>
            ) : (
              selectedDayDetails.events.map((evt) => {
                const badge = getBadgeStyle(evt.type);
                const IconComp = badge.icon;
                return (
                  <div
                    key={evt.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      backgroundColor: '#faf9f6',
                      border: `1px solid ${badge.border}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            fontWeight: 700,
                            border: `1px solid ${badge.border}`
                          }}
                        >
                          {evt.type}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#8c8882', fontWeight: 600 }}>{evt.time}</span>
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F1F1F' }}>{evt.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#78746d', marginTop: '0.25rem' }}>
                        Project: <strong>{evt.project}</strong> | Lead: <strong>{evt.assignedTo}</strong>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Modal>
      )}

      {/* Modal for Adding Event */}
      <Modal
        isOpen={isAddEventModalOpen}
        onClose={() => setIsAddEventModalOpen(false)}
        title="Add Event to Studio Calendar"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAddEventModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateEvent}>Save Event</button>
          </>
        }
      >
        <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>Event Title *</label>
            <input
              type="text"
              placeholder="e.g. 4K Render Sequence Review"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              className="top-bar-search-input"
              style={{ width: '100%', padding: '0.55rem 0.85rem' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>Event Date *</label>
            <input
              type="date"
              value={newEvent.date}
              onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
              className="top-bar-search-input"
              style={{ width: '100%', padding: '0.55rem 0.85rem' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>Event Type</label>
            <select
              value={newEvent.type}
              onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
              style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '10px', border: '1px solid #dcd8cf', backgroundColor: '#ffffff' }}
            >
              <option value="Milestone">Milestone</option>
              <option value="Delivery">Delivery</option>
              <option value="Meeting">Meeting</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>Project</label>
            <input
              type="text"
              placeholder="e.g. Hillcrest Luxury Villa"
              value={newEvent.project}
              onChange={(e) => setNewEvent({ ...newEvent, project: e.target.value })}
              className="top-bar-search-input"
              style={{ width: '100%', padding: '0.55rem 0.85rem' }}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
