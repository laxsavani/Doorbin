import apiClient from './apiClient';
import { authService } from './authService';

/**
 * Attendance Service for single-entry Clock-In, Clock-Out & Active Session tracking
 */
export const attendanceService = {
  // GET today's active attendance session for logged-in user
  getTodayAttendance: async () => {
    if (!authService.isAuthenticated()) {
      const stored = localStorage.getItem('mock_today_attendance');
      return stored ? JSON.parse(stored) : { isClockedIn: false, activeSession: null, workingHours: 0, averageWorkingHours: 8.2 };
    }
    try {
      const response = await apiClient.get('/attendance/today');
      return response.data;
    } catch (error) {
      console.warn('Backend attendance endpoint error, using local state:', error);
      const stored = localStorage.getItem('mock_today_attendance');
      return stored ? JSON.parse(stored) : { isClockedIn: false, activeSession: null, workingHours: 0, averageWorkingHours: 8.2 };
    }
  },

  // POST Clock In
  clockIn: async () => {
    if (!authService.isAuthenticated()) {
      const now = new Date();
      const mockSession = {
        isClockedIn: true,
        activeSession: {
          checkIn: now.toISOString(),
          checkInFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'Present'
        },
        workingHours: 0,
        averageWorkingHours: 8.2
      };
      localStorage.setItem('mock_today_attendance', JSON.stringify(mockSession));
      return { message: 'Clocked in successfully', ...mockSession };
    }
    try {
      const response = await apiClient.post('/attendance/clock-in');
      return response.data;
    } catch (error) {
      const msg = error.response?.data?.message || 'Clock in failed';
      throw new Error(msg);
    }
  },

  // POST Clock Out
  clockOut: async () => {
    if (!authService.isAuthenticated()) {
      const stored = localStorage.getItem('mock_today_attendance');
      const session = stored ? JSON.parse(stored) : {};
      const now = new Date();
      const checkInTime = session.activeSession?.checkIn ? new Date(session.activeSession.checkIn) : new Date(now.getTime() - 8.5 * 3600000);
      const workedHours = Number(((now.getTime() - checkInTime.getTime()) / 3600000).toFixed(2));

      const mockSession = {
        isClockedIn: false,
        activeSession: {
          checkIn: checkInTime.toISOString(),
          checkOut: now.toISOString(),
          checkInFormatted: checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          checkOutFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: workedHours < 4 ? 'Half-day' : 'Present',
          workingHours: workedHours
        },
        workingHours: workedHours,
        averageWorkingHours: 8.2
      };
      localStorage.setItem('mock_today_attendance', JSON.stringify(mockSession));
      return { message: 'Clocked out successfully', ...mockSession };
    }
    try {
      const response = await apiClient.post('/attendance/clock-out');
      return response.data;
    } catch (error) {
      const msg = error.response?.data?.message || 'Clock out failed';
      throw new Error(msg);
    }
  }
};
