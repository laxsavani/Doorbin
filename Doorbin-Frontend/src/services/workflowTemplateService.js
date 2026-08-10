import apiClient from './apiClient';

/**
 * Workflow Template Management Service
 * Pure 100% Dynamic API Integration
 */
export const workflowTemplateService = {
  // GET /workflow-templates
  getWorkflowTemplates: async () => {
    try {
      const response = await apiClient.get('/workflow-templates');
      return Array.isArray(response.data) ? response.data : (response.data?.templates || response.data?.data || []);
    } catch (err) {
      console.warn('Error fetching workflow templates:', err.message);
      return [];
    }
  },

  // POST /workflow-templates
  createWorkflowTemplate: async (templateData) => {
    const response = await apiClient.post('/workflow-templates', templateData);
    return response.data;
  },

  // PUT /workflow-templates/:category
  updateWorkflowTemplate: async (category, templateData) => {
    const response = await apiClient.put(`/workflow-templates/${encodeURIComponent(category)}`, templateData);
    return response.data;
  },

  // DELETE /workflow-templates/:category
  deleteWorkflowTemplate: async (category) => {
    const response = await apiClient.delete(`/workflow-templates/${encodeURIComponent(category)}`);
    return response.data;
  }
};
