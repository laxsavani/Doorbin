import apiClient from './apiClient';

/**
 * Project Management Service managing Module 5: Projects, Stages, Sub-Stages & Progress Cascade
 * Pure 100% Dynamic API Integration
 */
export const projectService = {
  // GET /projects
  getProjects: async (params = {}) => {
    try {
      const response = await apiClient.get('/projects', { params });
      return Array.isArray(response.data) ? response.data : (response.data?.projects || response.data?.data || []);
    } catch (err) {
      console.warn('Error fetching projects:', err.message);
      return [];
    }
  },

  // POST /projects
  createProject: async (projectData) => {
    const response = await apiClient.post('/projects', projectData);
    return response.data;
  },

  // GET /projects/:id
  getProjectById: async (id) => {
    const response = await apiClient.get(`/projects/${id}`);
    return response.data;
  },

  // PUT /projects/:id
  updateProject: async (id, projectData) => {
    const response = await apiClient.put(`/projects/${id}`, projectData);
    return response.data;
  },

  // DELETE /projects/:id (Soft delete: isDeleted: true)
  deleteProject: async (id) => {
    const response = await apiClient.delete(`/projects/${id}`);
    return response.data;
  },

  // POST /projects/:id/stages
  addStage: async (projectId, stageData) => {
    const response = await apiClient.post(`/projects/${projectId}/stages`, stageData);
    return response.data;
  },

  // DELETE /projects/:id/stages/:stageId
  deleteStage: async (projectId, stageId) => {
    const response = await apiClient.delete(`/projects/${projectId}/stages/${stageId}`);
    return response.data;
  },

  // PUT /projects/:id/stages/:stageId/substages/:subStageId
  updateSubStage: async (projectId, stageId, subStageId, subStageData) => {
    const response = await apiClient.put(`/projects/${projectId}/stages/${stageId}/substages/${subStageId}`, subStageData);
    return response.data;
  },

  // POST /projects/:id/substages/:subStageId/approve
  approveSubStage: async (projectId, subStageId) => {
    const response = await apiClient.post(`/projects/${projectId}/substages/${subStageId}/approve`);
    return response.data;
  },

  // GET /projects/reports/overview
  getProjectsOverviewReport: async () => {
    const response = await apiClient.get('/projects/reports/overview');
    return response.data;
  }
};
