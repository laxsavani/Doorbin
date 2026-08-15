import apiClient from './apiClient';

export const milestoneTrackerService = {
  // Fetch paginated milestone trackers with computed rollups
  getTrackers: async (params = {}) => {
    try {
      const response = await apiClient.get('/finance/milestone-tracker', { params });
      return response.data;
    } catch (err) {
      console.warn('Notice loading milestone payment trackers:', err.message);
      return { success: false, data: [], totalPages: 1, totalCount: 0, message: err.message };
    }
  },

  // Fetch milestone tracker for a specific project
  getTrackerByProject: async (projectId) => {
    try {
      const response = await apiClient.get(`/finance/milestone-tracker/${projectId}`);
      return response.data;
    } catch (err) {
      console.warn('Notice loading project tracker:', err.message);
      return { success: false, message: err.message };
    }
  },

  // Create new tracker for a project
  createTracker: async (payload) => {
    const response = await apiClient.post('/finance/milestone-tracker', payload);
    return response.data;
  },

  // Update full tracker document
  updateTracker: async (projectId, payload) => {
    const response = await apiClient.put(`/finance/milestone-tracker/${projectId}`, payload);
    return response.data;
  },

  // Single cell inline update
  updateSingleMilestone: async (projectId, milestoneNumber, payload) => {
    const response = await apiClient.put(`/finance/milestone-tracker/${projectId}/milestone/${milestoneNumber}`, payload);
    return response.data;
  },

  // Delete tracker document (Director restricted)
  deleteTracker: async (projectId) => {
    const response = await apiClient.delete(`/finance/milestone-tracker/${projectId}`);
    return response.data;
  },

  // Bulk Upload Excel/CSV
  bulkUpload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/finance/milestone-tracker/bulk-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Export Milestone Payment Trackers (Excel / PDF / CSV)
  exportTrackers: async (params = {}) => {
    try {
      const response = await apiClient.get('/finance/milestone-tracker/export', {
        params,
        responseType: 'blob'
      });
      return response;
    } catch (err) {
      console.warn('Notice exporting milestone tracker:', err.message);
      throw err;
    }
  }
};
