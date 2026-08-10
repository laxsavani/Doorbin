import apiClient from './apiClient';

/**
 * Role & Granular Permission Management Service
 * Pure 100% Dynamic API Integration
 */
export const roleService = {
  // GET /roles - List all system roles and custom roles
  async getRoles() {
    try {
      const response = await apiClient.get('/roles');
      return Array.isArray(response.data) ? response.data : (response.data?.roles || response.data?.data || []);
    } catch (err) {
      console.warn('Error fetching roles:', err.message);
      return [];
    }
  },

  // POST /roles - Create a new custom role
  async createRole(roleData) {
    const response = await apiClient.post('/roles', roleData);
    return response.data;
  },

  // PUT /roles/:id - Update role metadata & permission flags
  async updateRole(roleId, updateData) {
    const response = await apiClient.put(`/roles/${roleId}`, updateData);
    return response.data;
  },

  // DELETE /roles/:id - Delete a custom role
  async deleteRole(roleId) {
    const response = await apiClient.delete(`/roles/${roleId}`);
    return response.data;
  }
};
