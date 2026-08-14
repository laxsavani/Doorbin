import React, { useState, useEffect } from 'react';
import { attendanceService } from '../services/attendanceService';
import { authService } from '../services/authService';
import { Modal } from '../components/Modal';
import { Clock, Play, AlertCircle, Loader2 } from 'lucide-react';

export const useClockInGuard = () => {
  const [isClockedIn, setIsClockedIn] = useState(true);
  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);
  const [clockInLoading, setClockInLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const currentUser = authService.getCurrentUser();
  const roleObj = currentUser?.role;
  const roleName = typeof roleObj === 'string'
    ? roleObj
    : (roleObj?.name || currentUser?.roleName || 'Artist');

  const isDirector = roleName.toLowerCase() === 'director' || roleName.toLowerCase() === 'admin';

  useEffect(() => {
    checkAttendanceStatus();
  }, [isDirector]);

  const checkAttendanceStatus = async () => {
    if (isDirector) {
      setIsClockedIn(true);
      return true;
    }
    try {
      const data = await attendanceService.getTodayAttendance();
      const clocked = Boolean(data?.isClockedIn);
      setIsClockedIn(clocked);
      return clocked;
    } catch {
      setIsClockedIn(false);
      return false;
    }
  };

  /**
   * Guard function: Wraps any work action callback.
   * If user is Clocked In (or Director), executes callback immediately.
   * If user is Clocked Out, opens the Clock In Required Modal!
   */
  const requireClockIn = (actionCallback) => {
    if (isDirector || isClockedIn) {
      if (typeof actionCallback === 'function') actionCallback();
      return true;
    }

    setPendingAction(() => actionCallback);
    setIsClockInModalOpen(true);
    return false;
  };

  const handlePerformClockIn = async () => {
    setClockInLoading(true);
    try {
      await attendanceService.clockIn();
      setIsClockedIn(true);
      setIsClockInModalOpen(false);

      if (pendingAction && typeof pendingAction === 'function') {
        pendingAction();
        setPendingAction(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to clock in. Please try again.');
    } finally {
      setClockInLoading(false);
    }
  };

  const ClockInGuardModal = () => (
    <Modal
      isOpen={isClockInModalOpen}
      onClose={() => setIsClockInModalOpen(false)}
      title="Clock In Required"
      footer={
        <>
          <button className="btn btn-secondary" onClick={() => setIsClockInModalOpen(false)}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handlePerformClockIn}
            disabled={clockInLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#16a34a', borderColor: '#16a34a' }}
          >
            {clockInLoading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
            Clock In Now & Continue
          </button>
        </>
      }
    >
      <div style={{ padding: '0.5rem 0', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <Clock size={28} color="#dc2626" />
        </div>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1F1F1F', marginBottom: '0.5rem' }}>
          Please Clock In First
        </h3>

        <p style={{ fontSize: '0.85rem', color: '#525252', lineHeight: 1.5, margin: '0 0 1rem' }}>
          Per studio workflow policy, you must <strong>Clock In</strong> for your daily session before performing task and project work actions.
        </p>

        <div style={{ padding: '0.75rem', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '8px', fontSize: '0.78rem', color: '#c2410c', fontWeight: 600 }}>
          ⚡ Click <strong>"Clock In Now & Continue"</strong> below to start your shift timer and unlock all work features immediately.
        </div>
      </div>
    </Modal>
  );

  return {
    isClockedIn,
    requireClockIn,
    checkAttendanceStatus,
    ClockInGuardModal
  };
};
