import apiClient from './apiClient';

/**
 * Business Development (CRM) Service managing Module 4: Enquiries, Follow-ups, Activities & Sales Conversion
 * Pure 100% Dynamic API Integration
 */
export const enquiryService = {
  // GET /enquiries
  getEnquiries: async (params = {}) => {
    try {
      const response = await apiClient.get('/enquiries', { params });
      return Array.isArray(response.data) ? response.data : (response.data?.enquiries || response.data?.data || []);
    } catch (err) {
      console.warn('Error fetching enquiries:', err.message);
      return [];
    }
  },

  // POST /enquiries
  createEnquiry: async (enquiryData) => {
    const response = await apiClient.post('/enquiries', enquiryData);
    return response.data;
  },

  // GET /enquiries/:id
  getEnquiryById: async (id) => {
    const response = await apiClient.get(`/enquiries/${id}`);
    return response.data;
  },

  // PUT /enquiries/:id
  updateEnquiry: async (id, enquiryData) => {
    const response = await apiClient.put(`/enquiries/${id}`, enquiryData);
    return response.data;
  },

  // DELETE /enquiries/:id - Delete an enquiry record
  deleteEnquiry: async (id) => {
    const response = await apiClient.delete(`/enquiries/${id}`);
    return response.data;
  },

  // PUT /enquiries/:id/status
  updateEnquiryStatus: async (id, status, lostReason = '') => {
    const response = await apiClient.put(`/enquiries/${id}/status`, { status, lostReason });
    return response.data;
  },

  // POST /enquiries/:id/activity
  addActivityLog: async (id, activityData) => {
    const response = await apiClient.post(`/enquiries/${id}/activity`, activityData);
    return response.data;
  },

  // POST /enquiries/:id/convert
  convertEnquiry: async (id) => {
    const response = await apiClient.post(`/enquiries/${id}/convert`);
    return response.data;
  },

  // GET /enquiries/reports/pipeline
  getPipelineSummaryReport: async () => {
    const response = await apiClient.get('/enquiries/reports/pipeline');
    return response.data;
  }
};
