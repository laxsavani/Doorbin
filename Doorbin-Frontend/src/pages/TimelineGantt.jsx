import React, { useState, useEffect, useRef, useMemo } from 'react';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { formatDate } from '../utils/dateUtils';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import './Dashboard.css';

const PALETTES = [
  { fill: '#c08470', bg: '#f5e6e0', border: '#d49a88' }, // Terracotta / Brown
  { fill: '#74b9db', bg: '#e3f4fc', border: '#97cde6' }, // Sky Blue
  { fill: '#73aa86', bg: '#e4f3e9', border: '#91be9f' }, // Sage Green
  { fill: '#a38bc4', bg: '#f0ebf7', border: '#b9a4d4' }, // Purple
  { fill: '#bfb8a9', bg: '#f7f4ee', border: '#d1cbbe' }  // Sand / Beige
];

export const TimelineGantt = () => {
  const [projects, setProjects] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  // Separate Scroll Container Refs for Independent Navigation
  const ganttContainerRef = useRef(null);
  const artistContainerRef = useRef(null);

  useEffect(() => {
    fetchTimelineData();
  }, []);

  const fetchTimelineData = async () => {
    setLoading(true);
    try {
      const pData = await projectService.getProjects();
      const uData = await userService.getUsers();

      const extractedProjects = Array.isArray(pData) ? pData : (pData?.projects || pData?.data || []);
      const extractedUsers = Array.isArray(uData) ? uData : (uData?.users || uData?.data || []);

      setProjects(extractedProjects);
      setUsersList(extractedUsers);
    } catch (err) {
      setToast({ message: err.message || 'Failed to load timeline data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // DYNAMIC TIMELINE COMPUTATIONS (Derived 100% dynamically from Database Projects)
  const timelineMeta = useMemo(() => {
    const now = new Date();
    let minDate = new Date();
    let maxDate = new Date(Date.now() + 86400000 * 84); // Default 12 weeks ahead

    const validStarts = projects.map(p => p.startDate ? new Date(p.startDate) : null).filter(Boolean);
    const validEnds = projects.map(p => p.endDate ? new Date(p.endDate) : null).filter(Boolean);

    if (validStarts.length > 0) {
      const earliest = new Date(Math.min(...validStarts.map(d => d.getTime())));
      if (!isNaN(earliest.getTime())) minDate = earliest;
    }

    if (validEnds.length > 0) {
      const latest = new Date(Math.max(...validEnds.map(d => d.getTime())));
      if (!isNaN(latest.getTime())) maxDate = latest;
    }

    // Align minDate to preceding Monday
    const startDay = minDate.getDay();
    const diffToMonday = (startDay === 0 ? -6 : 1) - startDay;
    minDate.setDate(minDate.getDate() + diffToMonday);

    // Calculate total weeks dynamically (minimum 12 weeks)
    const spanMs = maxDate.getTime() - minDate.getTime();
    const calculatedWeeks = Math.max(12, Math.ceil(spanMs / (7 * 86400000)));

    const columns = [];
    let currentWeekIndex = 0;

    for (let i = 0; i < calculatedWeeks; i++) {
      const wStart = new Date(minDate);
      wStart.setDate(minDate.getDate() + i * 7);

      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);

      const monthLabel = wStart.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const dayLabel = wStart.getDate();
      const isCurrent = now >= wStart && now <= wEnd;
      if (isCurrent) currentWeekIndex = i;

      columns.push({
        label: `${monthLabel} ${dayLabel}`,
        start: wStart,
        end: wEnd,
        isCurrent,
        weekIndex: i
      });
    }

    const startMs = columns[0].start.getTime();
    const endMs = columns[columns.length - 1].end.getTime();
    const totalSpanMs = Math.max(86400000, endMs - startMs);

    const rangeText = `${columns[0].label} — ${columns[columns.length - 1].label} · ${columns.length} WEEKS`;

    return {
      columns,
      startMs,
      endMs,
      totalSpanMs,
      rangeText,
      currentWeekIndex
    };
  }, [projects]);

  // INDEPENDENT SCROLL HANDLERS

  // 1. Independent Scroll for Project Gantt Chart
  const handleGanttScrollBtn = (direction) => {
    if (!ganttContainerRef.current) return;
    if (direction === 'today') {
      const scrollPos = Math.max(0, (timelineMeta.currentWeekIndex / timelineMeta.columns.length) * 960 - 200);
      ganttContainerRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
    } else {
      const amount = direction === 'left' ? -320 : 320;
      ganttContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // 2. Independent Scroll for Artist Availability Heatmap
  const handleArtistScrollBtn = (direction) => {
    if (!artistContainerRef.current) return;
    if (direction === 'today') {
      const scrollPos = Math.max(0, (timelineMeta.currentWeekIndex / timelineMeta.columns.length) * 960 - 200);
      artistContainerRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
    } else {
      const amount = direction === 'left' ? -320 : 320;
      artistContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // Dynamic Insight Summary Generator
  const capacityInsight = useMemo(() => {
    if (usersList.length === 0) return 'Studio capacity dynamically synced with active projects.';

    const freeArtists = usersList.filter(u => {
      const uId = u._id.toString();
      const activeProjs = projects.filter(p => {
        if (p.status === 'Completed' || p.status === 'Cancelled') return false;
        const team = (p.assignedTeam || []).map(m => (typeof m === 'object' ? m._id?.toString() : m?.toString()));
        return team.includes(uId);
      });
      return activeProjs.length === 0;
    });

    if (freeArtists.length > 0) {
      const names = freeArtists.map(u => u.name).slice(0, 3).join(', ');
      return `Earliest openings for new work: ${names} (Currently Available). ${projects.length} live project schedule(s) tracked dynamically.`;
    }

    return `Full studio capacity active across ${projects.length} live project schedule(s). Team utilization dynamically synced with database.`;
  }, [projects, usersList]);

  return (
    <div className="dashboard-main-container smooth-fade-in" style={{ paddingBottom: '3rem' }}>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Main Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
        <h1 style={{ fontFamily: 'serif', fontStyle: 'italic', fontSize: '2.25rem', fontWeight: 400, color: '#1F1F1F', margin: 0 }}>
          Timeline
        </h1>

        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8c8882', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {timelineMeta.rangeText}
        </div>
      </div>

      {loading ? (
        <Loader text="Generating Gantt chart timeline matrix & team availability heatmap..." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.25rem' }}>
          
          {/* SECTION 1: DYNAMIC PROJECT TIMELINE GANTT CHART (INDEPENDENT SCROLL) */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e8e4dc', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            {/* Section Header Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #efeae1', backgroundColor: '#faf9f6', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1F1F1F' }}>
                Project Timelines ({projects.length})
              </div>

              {/* Dedicated Project Gantt Scroll Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  onClick={() => handleGanttScrollBtn('left')}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                  title="Scroll project chart left"
                >
                  <ChevronLeft size={14} /> Left
                </button>
                <button
                  onClick={() => handleGanttScrollBtn('today')}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#d9534f', borderColor: '#fca5a5', cursor: 'pointer' }}
                  title="Jump to current week"
                >
                  Today
                </button>
                <button
                  onClick={() => handleGanttScrollBtn('right')}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                  title="Scroll project chart right"
                >
                  Right <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Independent Scroll Container */}
            <div
              ref={ganttContainerRef}
              style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
            >
              <div style={{ minWidth: `${Math.max(960, timelineMeta.columns.length * 80)}px`, position: 'relative' }}>
                
                {/* Red Current Date Vertical Line */}
                {timelineMeta.currentWeekIndex >= 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `calc(220px + ((100% - 220px) * (${timelineMeta.currentWeekIndex + 0.5} / ${timelineMeta.columns.length})))`,
                      top: 0,
                      bottom: 0,
                      width: '2px',
                      backgroundColor: '#d9534f',
                      zIndex: 8,
                      pointerEvents: 'none'
                    }}
                  />
                )}

                {/* Grid Header Row */}
                <div style={{ display: 'flex', borderBottom: '1px solid #efeae1', backgroundColor: '#faf9f6' }}>
                  <div
                    style={{
                      width: '220px',
                      padding: '0.85rem 1.25rem',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      color: '#8c8882',
                      textTransform: 'uppercase',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#faf9f6',
                      zIndex: 10,
                      borderRight: '1px solid #efeae1'
                    }}
                  >
                    Projects
                  </div>

                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${timelineMeta.columns.length}, 1fr)` }}>
                    {timelineMeta.columns.map((w, idx) => (
                      <div
                        key={w.label + idx}
                        style={{
                          padding: '0.85rem 0.5rem',
                          textAlign: 'center',
                          fontSize: '0.7rem',
                          fontWeight: w.isCurrent ? 800 : 700,
                          color: w.isCurrent ? '#d9534f' : '#8c8882',
                          letterSpacing: '0.04em',
                          borderRight: idx < timelineMeta.columns.length - 1 ? '1px solid #efeae1' : 'none'
                        }}
                      >
                        {w.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dynamic Project Gantt Rows */}
                {projects.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#8c8882', fontStyle: 'italic' }}>
                    No active projects scheduled for timeline preview.
                  </div>
                ) : (
                  projects.map((proj, pIdx) => {
                    const pmName = typeof proj.productionManager === 'object'
                      ? (proj.productionManager?.name || 'PM Lead')
                      : (proj.productionManager || 'PM Lead');
                    
                    const palette = PALETTES[pIdx % PALETTES.length];
                    const pStart = proj.startDate ? new Date(proj.startDate).getTime() : timelineMeta.startMs;
                    const pEnd = proj.endDate ? new Date(proj.endDate).getTime() : (pStart + 86400000 * 30);
                    const progress = Number(proj.progressPercentage || 0);

                    // Position Math derived 100% dynamically from Database Dates
                    const clampedStart = Math.max(timelineMeta.startMs, Math.min(timelineMeta.endMs, pStart));
                    const clampedEnd = Math.max(clampedStart + 86400000 * 3, Math.min(timelineMeta.endMs, pEnd));
                    
                    const leftPct = Math.max(0, Math.min(95, ((clampedStart - timelineMeta.startMs) / timelineMeta.totalSpanMs) * 100));
                    const widthPct = Math.max(4, Math.min(100 - leftPct, ((clampedEnd - clampedStart) / timelineMeta.totalSpanMs) * 100));

                    return (
                      <div
                        key={proj._id}
                        style={{
                          display: 'flex',
                          borderBottom: '1px solid #f4f0e8',
                          minHeight: '68px',
                          alignItems: 'center',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        {/* Left Project Title & Lead */}
                        <div
                          style={{
                            width: '220px',
                            padding: '0.85rem 1.25rem',
                            position: 'sticky',
                            left: 0,
                            backgroundColor: '#ffffff',
                            zIndex: 9,
                            borderRight: '1px solid #efeae1',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center'
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1F1F1F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {proj.projectName}
                          </div>
                          <div style={{ fontSize: '0.725rem', color: '#8c8882', marginTop: '0.15rem' }}>
                            {pmName}
                          </div>
                        </div>

                        {/* Right Gantt Bar Cell */}
                        <div style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'center', padding: '0 0.5rem' }}>
                          {/* Background Grid Columns Lines */}
                          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'grid', gridTemplateColumns: `repeat(${timelineMeta.columns.length}, 1fr)`, pointerEvents: 'none' }}>
                            {timelineMeta.columns.map((w, idx) => (
                              <div key={idx} style={{ borderRight: idx < timelineMeta.columns.length - 1 ? '1px solid #f7f3eb' : 'none' }} />
                            ))}
                          </div>

                          {/* Dynamic Gantt Bar */}
                          <div
                            style={{
                              position: 'relative',
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              height: '32px',
                              borderRadius: '16px',
                              backgroundColor: palette.bg,
                              border: `1px solid ${palette.border}`,
                              overflow: 'hidden',
                              display: 'flex',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                            }}
                            title={`${proj.projectName}: ${progress}% completed (${proj.startDate ? formatDate(proj.startDate) : 'Start'} — ${proj.endDate ? formatDate(proj.endDate) : 'End'})`}
                          >
                            {/* Solid Fill Progress Section */}
                            <div
                              style={{
                                width: `${progress}%`,
                                height: '100%',
                                backgroundColor: palette.fill,
                                borderRadius: progress >= 95 ? '16px' : '16px 0 0 16px',
                                transition: 'width 0.4s ease'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: DYNAMIC ARTIST AVAILABILITY TIMELINE HEATMAP (INDEPENDENT SCROLL) */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e8e4dc', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            {/* Section Header Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #efeae1', backgroundColor: '#faf9f6', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1F1F1F', margin: 0 }}>
                  Artist availability
                </h2>
                <div style={{ fontSize: '0.75rem', color: '#8c8882', fontWeight: 600, display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#d4967d' }} /> booked
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#eedebc' }} /> partial
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#ffffff', border: '1px solid #dcd8cf' }} /> free
                  </span>
                </div>
              </div>

              {/* Dedicated Artist Availability Scroll Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  onClick={() => handleArtistScrollBtn('left')}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                  title="Scroll artist availability left"
                >
                  <ChevronLeft size={14} /> Left
                </button>
                <button
                  onClick={() => handleArtistScrollBtn('today')}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#d9534f', borderColor: '#fca5a5', cursor: 'pointer' }}
                  title="Jump to current week"
                >
                  Today
                </button>
                <button
                  onClick={() => handleArtistScrollBtn('right')}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                  title="Scroll artist availability right"
                >
                  Right <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Independent Scroll Container */}
            <div
              ref={artistContainerRef}
              style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
            >
              <div style={{ minWidth: `${Math.max(960, timelineMeta.columns.length * 80)}px` }}>
                
                {/* Dynamic Artist Availability Rows */}
                {usersList.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#8c8882', fontStyle: 'italic' }}>
                    No team members loaded.
                  </div>
                ) : (
                  usersList.map((user) => {
                    const uId = user._id.toString();
                    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                    const roleTitle = typeof user.role === 'object' ? (user.role?.name || 'Team Member') : (user.role || 'Team Member');

                    // Find assigned active projects for this user dynamically
                    const userProjects = projects.filter(p => {
                      if (p.status === 'Completed' || p.status === 'Cancelled') return false;
                      const team = (p.assignedTeam || []).map(m => (typeof m === 'object' ? m._id?.toString() : m?.toString()));
                      return team.includes(uId);
                    });

                    return (
                      <div
                        key={uId}
                        style={{
                          display: 'flex',
                          borderBottom: '1px solid #f4f0e8',
                          minHeight: '60px',
                          alignItems: 'center',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        {/* Left Artist Profile Column */}
                        <div
                          style={{
                            width: '220px',
                            padding: '0.75rem 1.25rem',
                            position: 'sticky',
                            left: 0,
                            backgroundColor: '#ffffff',
                            zIndex: 9,
                            borderRight: '1px solid #efeae1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem'
                          }}
                        >
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#64748b', color: '#ffffff', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div style={{ minWidth: '0' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.825rem', color: '#1F1F1F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {user.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#8c8882', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {roleTitle} ({userProjects.length} active)
                            </div>
                          </div>
                        </div>

                        {/* Right Dynamic Weekly Availability Heatmap Pills */}
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${timelineMeta.columns.length}, 1fr)`, gap: '0.35rem', padding: '0.5rem 0.65rem' }}>
                          {timelineMeta.columns.map((w, wIdx) => {
                            // Check if user is working on active project(s) during this specific week interval dynamically
                            const activeInWeek = userProjects.filter(p => {
                              const pStart = p.startDate ? new Date(p.startDate) : null;
                              const pEnd = p.endDate ? new Date(p.endDate) : null;
                              if (!pStart || !pEnd) return false;
                              return (pStart <= w.end && pEnd >= w.start);
                            });

                            let blockStyle = {
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2ddd3'
                            };

                            if (activeInWeek.length >= 2) {
                              blockStyle = {
                                backgroundColor: '#d4967d', // Fully Booked terracotta (2+ projects)
                                border: '1px solid #c8876c'
                              };
                            } else if (activeInWeek.length === 1) {
                              blockStyle = {
                                backgroundColor: '#eedebc', // Partially Booked beige (1 project)
                                border: '1px solid #e2cfaa'
                              };
                            }

                            return (
                              <div
                                key={wIdx}
                                style={{
                                  height: '28px',
                                  borderRadius: '6px',
                                  ...blockStyle,
                                  transition: 'all 0.2s ease'
                                }}
                                title={`${user.name} - ${w.label}: ${activeInWeek.length > 0 ? `Assigned to ${activeInWeek.map(p=>p.projectName).join(', ')}` : 'Available / Free'}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: DYNAMIC STUDIO CAPACITY INSIGHT CALLOUT BOX */}
          <div
            style={{
              backgroundColor: '#fbf8f3',
              border: '1px solid #ede7dc',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              fontSize: '0.8rem',
              color: '#6b665f',
              lineHeight: 1.5
            }}
          >
            {capacityInsight}
          </div>

        </div>
      )}
    </div>
  );
};
