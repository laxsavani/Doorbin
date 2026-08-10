import React, { useState, useEffect } from 'react';
import { Play, Square, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { attendanceService } from '../services/attendanceService';
import { authService } from '../services/authService';

export const ClockInOutWidget = ({ variant = 'topbar', onStatusChange }) => {
  const [attendance, setAttendance] = useState(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00h 00m');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const currentUser = authService.getCurrentUser();
  const roleObj = currentUser?.role;
  const roleName = typeof roleObj === 'string'
    ? roleObj
    : (roleObj?.name || currentUser?.roleName || 'Artist');

  const isDirector = roleName.toLowerCase() === 'director';

  // Fetch today's attendance state on mount
  useEffect(() => {
    if (isDirector) return;

    fetchAttendance();
  }, [isDirector]);

  // Live timer tick when clocked in
  useEffect(() => {
    if (!isClockedIn || !attendance?.activeSession?.checkIn) return;

    const interval = setInterval(() => {
      const checkInTime = new Date(attendance.activeSession.checkIn).getTime();
      const now = new Date().getTime();
      const diffMs = Math.max(0, now - checkInTime);

      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      setElapsedTime(`${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [isClockedIn, attendance]);

  const fetchAttendance = async () => {
    try {
      const data = await attendanceService.getTodayAttendance();
      if (data) {
        setAttendance(data);
        setIsClockedIn(Boolean(data.isClockedIn));
        if (onStatusChange) onStatusChange(data);
      }
    } catch (err) {
      console.error('Error fetching today attendance:', err);
    }
  };

  const handleClockIn = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await attendanceService.clockIn();
      setAttendance(res);
      setIsClockedIn(true);
      setSuccessMsg(res.message || 'Successfully Clocked In!');
      if (onStatusChange) onStatusChange(res);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Clock In failed');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await attendanceService.clockOut();
      setAttendance(res);
      setIsClockedIn(false);
      setSuccessMsg(res.message || 'Successfully Clocked Out!');
      if (onStatusChange) onStatusChange(res);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Clock Out failed');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  // If Director (Admin role), hide Clock In/Out button as per requirement
  if (isDirector) {
    if (variant === 'card') {
      return (
        <div style={{
          padding: '1.25rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: '#4F46E5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFF'
          }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
              Director Admin Overview
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Attendance tracking active for all staff & artist team members.
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  const checkInFormatted = attendance?.activeSession?.checkInFormatted || (attendance?.activeSession?.checkIn ? new Date(attendance.activeSession.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
  const checkOutFormatted = attendance?.activeSession?.checkOutFormatted || (attendance?.activeSession?.checkOut ? new Date(attendance.activeSession.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
  const isShiftDone = !isClockedIn && attendance?.activeSession?.checkOut;

  // Variant 1: Topbar Compact Badge Button
  if (variant === 'topbar') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {errorMsg && (
          <div style={{
            fontSize: '0.75rem',
            color: '#EF4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}>
            <AlertCircle size={12} /> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{
            fontSize: '0.75rem',
            color: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}>
            <CheckCircle2 size={12} /> {successMsg}
          </div>
        )}

        {isClockedIn ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '0.35rem 0.75rem',
            borderRadius: '20px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              boxShadow: '0 0 8px #10B981',
              animation: 'pulse 1.5s infinite'
            }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065F46', lineHeight: 1.1 }}>
                In since {checkInFormatted || 'Today'}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#047857', fontFamily: 'monospace', fontWeight: 600 }}>
                ⏱ {elapsedTime}
              </span>
            </div>
            <button
              onClick={handleClockOut}
              disabled={loading}
              style={{
                backgroundColor: '#EF4444',
                color: '#FFF',
                border: 'none',
                borderRadius: '12px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)',
                transition: 'all 0.2s ease'
              }}
              title="Clock Out of shift"
            >
              {loading ? <Loader2 size={14} className="spin" /> : <Square size={13} fill="currentColor" />}
              Clock Out
            </button>
          </div>
        ) : isShiftDone ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            padding: '0.35rem 0.75rem',
            borderRadius: '20px'
          }}>
            <CheckCircle2 size={14} color="#3B82F6" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E40AF' }}>
              Shift Done ({attendance?.workingHours || 8} hrs)
            </span>
            <button
              onClick={handleClockIn}
              disabled={loading}
              style={{
                backgroundColor: '#3B82F6',
                color: '#FFF',
                border: 'none',
                borderRadius: '12px',
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              {loading ? <Loader2 size={12} className="spin" /> : <Play size={11} fill="currentColor" />}
              Re-Clock
            </button>
          </div>
        ) : (
          <button
            onClick={handleClockIn}
            disabled={loading}
            style={{
              backgroundColor: '#10B981',
              color: '#FFF',
              border: 'none',
              borderRadius: '20px',
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? <Loader2 size={14} className="spin" /> : <Play size={14} fill="currentColor" />}
            Clock In
          </button>
        )}
      </div>
    );
  }

  // Variant 2: Full Dashboard/HR Card
  return (
    <div style={{
      backgroundColor: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: '16px',
      padding: '1.25rem',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: isClockedIn ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isClockedIn ? '#10B981' : '#6366F1'
          }}>
            <Clock size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Daily Shift Attendance</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Logged in as {roleName}
            </span>
          </div>
        </div>

        <div style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          padding: '0.25rem 0.6rem',
          borderRadius: '12px',
          backgroundColor: isClockedIn ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: isClockedIn ? '#10B981' : '#EF4444'
        }}>
          {isClockedIn ? '• CLOCKED IN' : isShiftDone ? '✓ SHIFT COMPLETED' : '• NOT CLOCKED IN'}
        </div>
      </div>

      {errorMsg && (
        <div style={{ fontSize: '0.8rem', color: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ fontSize: '0.8rem', color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
          {successMsg}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.75rem',
        backgroundColor: 'var(--color-bg-body)',
        padding: '0.85rem',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', uppercase: true }}>Clock In</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{checkInFormatted || '--:--'}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', uppercase: true }}>Clock Out</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{checkOutFormatted || '--:--'}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', uppercase: true }}>Worked Hours</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#3B82F6' }}>
            {isClockedIn ? elapsedTime : `${attendance?.workingHours || 0} hrs`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {isClockedIn ? (
          <button
            onClick={handleClockOut}
            disabled={loading}
            style={{
              flex: 1,
              backgroundColor: '#EF4444',
              color: '#FFF',
              border: 'none',
              borderRadius: '10px',
              padding: '0.65rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Square size={16} fill="currentColor" />}
            Clock Out Now
          </button>
        ) : (
          <button
            onClick={handleClockIn}
            disabled={loading}
            style={{
              flex: 1,
              backgroundColor: '#10B981',
              color: '#FFF',
              border: 'none',
              borderRadius: '10px',
              padding: '0.65rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Play size={16} fill="currentColor" />}
            {isShiftDone ? 'Re-Clock Shift' : 'Clock In Now'}
          </button>
        )}
      </div>
    </div>
  );
};
