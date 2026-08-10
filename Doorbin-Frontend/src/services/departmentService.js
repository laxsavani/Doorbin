import apiClient from './apiClient';

/**
 * Department Management Service complying with exact Department Mongoose Schema:
 * Schema: name, description, head (ObjectId ref User), parentDepartment (ObjectId ref Department), employees ([ObjectId ref User]), status ('Active'|'Inactive')
 * Pure 100% Dynamic API Integration
 */
export const departmentService = {
  // GET /departments - List all departments with populated head and employees
  async getDepartments() {
    try {
      const response = await apiClient.get('/departments');
      return Array.isArray(response.data) ? response.data : (response.data?.departments || response.data?.data || []);
    } catch (err) {
      console.warn('Error fetching departments:', err.message);
      return [];
    }
  },

  // GET /departments/:id
  async getDepartmentById(id) {
    const response = await apiClient.get(`/departments/${id}`);
    return response.data;
  },

  // POST /departments - Create a new department adhering strictly to schema
  async createDepartment(data) {
    const response = await apiClient.post('/departments', {
      name: data.name,
      description: data.description || '',
      head: data.head || null,
      parentDepartment: data.parentDepartment || null,
      status: data.status || 'Active'
    });
    return response.data;
  },

  // PUT /departments/:id - Update department details
  async updateDepartment(id, data) {
    const response = await apiClient.put(`/departments/${id}`, data);
    return response.data;
  },

  // DELETE /departments/:id - Delete department
  async deleteDepartment(id) {
    const response = await apiClient.delete(`/departments/${id}`);
    return response.data;
  },

  // GET /departments/reports/strength - System-wide department strength report
  async getDepartmentStrengthReport() {
    try {
      const response = await apiClient.get('/departments/reports/strength');
      return response.data;
    } catch (err) {
      console.warn('Error fetching department strength report:', err.message);
      return { totalDepartments: 0, totalStaff: 0, departmentBreakdown: [] };
    }
  },

  // POST /departments/:id/assign-employee
  async assignEmployee(departmentId, userId) {
    const response = await apiClient.post(`/departments/${departmentId}/assign-employee`, { userId });
    return response.data;
  },

  // POST /departments/:id/remove-employee
  async removeEmployee(departmentId, userId) {
    const response = await apiClient.post(`/departments/${departmentId}/remove-employee`, { userId });
    return response.data;
  }
};
