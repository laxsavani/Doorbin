import apiClient from './apiClient';

/**
 * Client Management Service managing Module 3: Client Master, Contacts, Communication Logs & Financial Ledger Statements
 * Pure 100% Dynamic API Integration
 */
export const clientService = {
  // GET /clients - List clients with text search & filters
  async getClients(filters = {}) {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await apiClient.get(`/clients${queryParams ? `?${queryParams}` : ''}`);
      return Array.isArray(response.data) ? response.data : (response.data?.clients || response.data?.data || []);
    } catch (err) {
      console.warn('Error fetching clients:', err.message);
      return [];
    }
  },

  // GET /clients/:id - Get single client details
  async getClientById(id) {
    const response = await apiClient.get(`/clients/${id}`);
    return response.data;
  },

  // POST /clients - Create a new client record
  async createClient(data) {
    const response = await apiClient.post('/clients', data);
    return response.data;
  },

  // PUT /clients/:id - Update client details
  async updateClient(id, data) {
    const response = await apiClient.put(`/clients/${id}`, data);
    return response.data;
  },

  // DELETE /clients/:id - Soft-delete/deactivate client (Director ONLY)
  async deleteClient(id) {
    const response = await apiClient.delete(`/clients/${id}`);
    return response.data;
  },

  // POST /clients/:id/contacts - Add an additional contact person
  async addContact(clientId, contactData) {
    const response = await apiClient.post(`/clients/${clientId}/contacts`, contactData);
    return response.data;
  },

  // PUT /clients/:id/contacts/:contactId - Update contact person
  async updateContact(clientId, contactId, contactData) {
    const response = await apiClient.put(`/clients/${clientId}/contacts/${contactId}`, contactData);
    return response.data;
  },

  // DELETE /clients/:id/contacts/:contactId - Remove contact person
  async deleteContact(clientId, contactId) {
    const response = await apiClient.delete(`/clients/${clientId}/contacts/${contactId}`);
    return response.data;
  },

  // POST /clients/:id/communication - Log a client communication entry ('Call'|'Email'|'Meeting'|'Note')
  async logCommunication(clientId, commData) {
    const response = await apiClient.post(`/clients/${clientId}/communication`, commData);
    return response.data;
  },

  // GET /clients/:id/communication - Get communication logs
  async getCommunicationLogs(clientId) {
    const response = await apiClient.get(`/clients/${clientId}/communication`);
    return response.data;
  },

  // GET /clients/:id/projects - Get projects linked to client
  async getClientProjects(clientId) {
    try {
      const response = await apiClient.get(`/clients/${clientId}/projects`);
      return response.data;
    } catch (err) {
      console.warn('Error fetching client projects:', err.message);
      return [];
    }
  },

  // GET /clients/:id/payments - Get payments linked to client
  async getClientPayments(clientId) {
    try {
      const response = await apiClient.get(`/clients/${clientId}/payments`);
      return response.data;
    } catch (err) {
      console.warn('Error fetching client payments:', err.message);
      return [];
    }
  },

  // GET /clients/:id/statement - Financial summary statement
  async getClientStatement(clientId) {
    try {
      const response = await apiClient.get(`/clients/${clientId}/statement`);
      return response.data;
    } catch (err) {
      console.warn('Error fetching client statement:', err.message);
      return { totalBilled: 0, totalPaid: 0, balanceOutstanding: 0, currency: 'INR', invoices: [] };
    }
  }
};
