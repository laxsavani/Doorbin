import apiClient from './apiClient';

/**
 * Timeline, Gantt Chart & Studio Calendar Service managing Module 7
 * Pure 100% Dynamic API Integration
 */
export const timelineService = {
  // GET /timeline/project/:id (Gantt Chart Tree)
  getProjectTimeline: async (projectId) => {
    const response = await apiClient.get(`/timeline/project/${projectId}`);
    return response.data;
  },

  // GET /timeline/critical-path/:projectId
  getCriticalPath: async (projectId) => {
    const response = await apiClient.get(`/timeline/critical-path/${projectId}`);
    return response.data;
  },

  // GET /timeline/planned-vs-actual/:projectId
  getPlannedVsActual: async (projectId) => {
    const response = await apiClient.get(`/timeline/planned-vs-actual/${projectId}`);
    return response.data;
  },

  // PUT /timeline/task/:id/reschedule
  rescheduleTask: async (taskId, rescheduleData) => {
    const response = await apiClient.put(`/timeline/task/${taskId}/reschedule`, rescheduleData);
    return response.data;
  },

  // GET /calendar
  getStudioCalendar: async (params = {}) => {
    try {
      const response = await apiClient.get('/calendar', { params });
      return Array.isArray(response.data) ? response.data : (response.data?.events || response.data?.data || []);
    } catch (err) {
      console.warn('Error fetching studio calendar:', err.message);
      return [];
    }
  }
};
