import apiClient from './apiClient';

/**
 * Task Management Service managing Module 6: Tasks, WIP File Uploads, Review Verdicts & Comments
 * Pure 100% Dynamic API Integration
 */
export const taskService = {
  // GET /tasks
  getTasks: async (params = {}) => {
    try {
      const response = await apiClient.get('/tasks', { params });
      return Array.isArray(response.data) ? response.data : (response.data?.tasks || response.data?.data || []);
    } catch (err) {
      console.warn('Error fetching tasks:', err.message);
      return [];
    }
  },

  // GET /tasks/my-tasks
  getMyTasks: async () => {
    try {
      const response = await apiClient.get('/tasks/my-tasks');
      return Array.isArray(response.data) ? response.data : (response.data?.tasks || response.data?.data || []);
    } catch (err) {
      console.warn('Error fetching my-tasks:', err.message);
      return [];
    }
  },

  // GET /tasks/today
  getTodayTasks: async () => {
    try {
      const response = await apiClient.get('/tasks/today');
      return Array.isArray(response.data) ? response.data : (response.data?.tasks || response.data?.data || []);
    } catch (err) {
      console.warn('Error fetching today tasks:', err.message);
      return [];
    }
  },

  // GET /tasks/overdue
  getOverdueTasks: async () => {
    try {
      const response = await apiClient.get('/tasks/overdue');
      return Array.isArray(response.data) ? response.data : (response.data?.tasks || response.data?.data || []);
    } catch (err) {
      console.warn('Error fetching overdue tasks:', err.message);
      return [];
    }
  },

  // POST /tasks
  createTask: async (taskData) => {
    const response = await apiClient.post('/tasks', taskData);
    return response.data?.data || response.data;
  },

  // PUT /tasks/:id
  updateTask: async (id, taskData) => {
    const response = await apiClient.put(`/tasks/${id}`, taskData);
    return response.data?.data || response.data;
  },

  // DELETE /tasks/:id - Delete a task record
  deleteTask: async (id) => {
    const response = await apiClient.delete(`/tasks/${id}`);
    return response.data;
  },

  // PUT /tasks/:id/status
  updateTaskStatus: async (id, status) => {
    const response = await apiClient.put(`/tasks/${id}/status`, { status });
    return response.data?.data || response.data;
  },

  // POST /tasks/:id/submit
  submitTaskWork: async (id, payload) => {
    const response = await apiClient.post(`/tasks/${id}/submit`, payload);
    return response.data?.data || response.data;
  },

  // POST /tasks/:id/review
  reviewTaskVerdict: async (id, decisionPayload) => {
    const response = await apiClient.post(`/tasks/${id}/review`, decisionPayload);
    return response.data?.data || response.data;
  },

  // POST /tasks/:id/comments
  addComment: async (id, commentText) => {
    const response = await apiClient.post(`/tasks/${id}/comments`, { text: commentText });
    return response.data?.data || response.data;
  }
};
