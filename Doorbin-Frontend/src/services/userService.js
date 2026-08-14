import apiClient from './apiClient';

/**
 * User Management Service complying with exact User Mongoose Schema:
 * Schema: name, email, password, role (ObjectId), department (ObjectId), phone, status ('Active'|'Inactive'), profileImage, lastLogin
 * Pure 100% Dynamic API Integration
 */
export const userService = {
  // GET /users - List all users with populated role and department ObjectIds
  async getUsers(filters = {}) {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await apiClient.get(`/users${queryParams ? `?${queryParams}` : ''}`);
      return Array.isArray(response.data) ? response.data : (response.data?.users || response.data?.data || []);
    } catch (err) {
      console.warn('Error fetching users:', err.message);
      return [];
    }
  },

  // GET /users/:id - Get user details by ID
  async getUserById(id) {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  },

  // POST /users - Create new user account (Director only)
  async createUser(userData) {
    try {
      const response = await apiClient.post('/users', userData);
      return response.data;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        // Fallback to /auth/register endpoint if /users POST route isn't deployed on target server
        const fallbackResponse = await apiClient.post('/auth/register', userData);
        return fallbackResponse.data;
      }
      throw err;
    }
  },

  // PUT /users/:id - Update user profile, skills, designation, shift times
  async updateUser(id, userData) {
    const response = await apiClient.put(`/users/${id}`, userData);
    return response.data;
  },

  // DELETE /users/:id - Soft-deactivate user account
  async deleteUser(id) {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  },

  // PATCH /users/:id/status - Toggle user status ('Active' | 'Inactive')
  async toggleUserStatusPatch(id, status) {
    const response = await apiClient.patch(`/users/${id}/status`, { status });
    return response.data;
  },

  // PUT /users/:id/status - Update user status ('Active' | 'Inactive')
  async updateUserStatus(id, status) {
    const response = await apiClient.put(`/users/${id}/status`, { status });
    return response.data;
  },

  // PUT /users/:id/role - Reassign user role ObjectId
  async updateUserRole(id, roleId) {
    const response = await apiClient.put(`/users/${id}/role`, { role: roleId });
    return response.data;
  }
};
