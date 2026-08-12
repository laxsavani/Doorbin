import apiClient from './apiClient';

/**
 * Activity Log / Audit Trail Service complying with exact ActivityLog Mongoose Schema:
 * Schema: user (ObjectId ref User), action, targetType, targetId, ipAddress, metadata, timestamp
 * Pure 100% Dynamic API Integration
 */
export const auditService = {
  // GET /activity-logs - Fetch paginated audit trail logs
  async getActivityLogs(page = 1, limit = 20) {
    try {
      const response = await apiClient.get(`/activity-logs?page=${page}&limit=${limit}`);
      return response.data;
    } catch (err) {
      console.warn('Error fetching activity logs:', err.message);
      return { total: 0, page, limit, logs: [] };
    }
  },

  // GET /health - Check backend system health & uptime
  async getHealth() {
    const response = await apiClient.get('/health');
    return response.data;
  }
};
