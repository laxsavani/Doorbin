import apiClient from './apiClient';

/**
 * Helper to safely extract Array from API response structure
 */
const extractArray = (resData, key) => {
  if (Array.isArray(resData)) return resData;
  if (resData && Array.isArray(resData.data)) return resData.data;
  if (key && resData && Array.isArray(resData[key])) return resData[key];
  return [];
};

/**
 * Reporting & Analytics Service managing Module 12: Filterable Reports, Excel/PDF Export Engine & Scheduled Email Reports
 * Pure 100% Dynamic API Integration
 */
export const reportService = {
  // FILTERABLE REPORTS API
  getProjectReports: async (params = {}) => {
    try {
      const response = await apiClient.get('/reports/projects', { params });
      const raw = response.data?.data || response.data;

      if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.summary && Array.isArray(raw.projectsList)) {
        return raw;
      }

      const list = Array.isArray(raw) ? raw : (raw?.projectsList || raw?.projects || []);
      const totalProjects = list.length;
      const activeCount = list.filter(p => p.status === 'In Progress' || p.status === 'Active').length;
      const completedCount = list.filter(p => p.status === 'Completed').length;
      const delayedCount = list.filter(p => p.status === 'Delayed' || p.delayDays > 0).length;
      const avgCompletionPercentage = totalProjects > 0
        ? Math.round(list.reduce((acc, p) => acc + (p.progressPercentage || p.progress || 0), 0) / totalProjects)
        : 0;

      return {
        summary: raw?.summary || { totalProjects, activeCount, completedCount, delayedCount, avgCompletionPercentage },
        projectsList: list.map(p => ({
          projectName: p.projectName || p.title || 'Untitled Project',
          category: p.category || p.projectCategory || 'Architecture',
          status: p.status || 'In Progress',
          progressPercentage: p.progressPercentage || p.progress || 0,
          delayDays: p.delayDays || 0,
          budget: p.budget || 0
        }))
      };
    } catch (err) {
      console.warn('Error fetching project reports:', err.message);
      return { summary: { totalProjects: 0, activeCount: 0, completedCount: 0, delayedCount: 0, avgCompletionPercentage: 0 }, projectsList: [] };
    }
  },

  getEmployeeReports: async (params = {}) => {
    try {
      const response = await apiClient.get('/reports/employees', { params });
      const raw = response.data?.data || response.data;

      if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.employeeMetrics) {
        return raw;
      }

      const list = Array.isArray(raw) ? raw : (raw?.employeeMetrics || raw?.employees || []);
      return {
        overallUtilization: raw?.overallUtilization || 0,
        employeeMetrics: list.map(e => ({
          name: e.name || e.user?.name || 'Staff Member',
          role: e.role || e.user?.role?.name || 'Artist',
          completedTasks: e.completedTasks || 0,
          pendingTasks: e.pendingTasks || 0,
          utilizationRate: e.utilizationRate || '0%',
          performanceScore: e.performanceScore || 0
        }))
      };
    } catch (err) {
      console.warn('Error fetching employee reports:', err.message);
      return { overallUtilization: 0, employeeMetrics: [] };
    }
  },

  getFinanceReports: async (params = {}) => {
    try {
      const response = await apiClient.get('/reports/finance', { params });
      const raw = response.data?.data || response.data;

      return {
        totalRevenue: raw?.totalRevenue || raw?.revenue || 0,
        totalCollected: raw?.totalCollected || raw?.collected || 0,
        totalOutstanding: raw?.totalOutstanding || raw?.outstanding || 0,
        estimatedProfitabilityMargin: raw?.estimatedProfitabilityMargin || '0%',
        receivablesSummary: raw?.receivablesSummary || { due0to30: 0, due31to60: 0, due60Plus: 0 }
      };
    } catch (err) {
      console.warn('Error fetching finance reports:', err.message);
      return { totalRevenue: 0, totalCollected: 0, totalOutstanding: 0, estimatedProfitabilityMargin: '0%', receivablesSummary: { due0to30: 0, due31to60: 0, due60Plus: 0 } };
    }
  },

  getProductivityReports: async (params = {}) => {
    try {
      const response = await apiClient.get('/reports/productivity', { params });
      const raw = response.data?.data || response.data;

      return {
        avgTaskCompletionTimeDays: raw?.avgTaskCompletionTimeDays || 0,
        departmentEfficiency: Array.isArray(raw?.departmentEfficiency) ? raw.departmentEfficiency : [],
        delayCausesBreakdown: Array.isArray(raw?.delayCausesBreakdown) ? raw.delayCausesBreakdown : []
      };
    } catch (err) {
      console.warn('Error fetching productivity reports:', err.message);
      return { avgTaskCompletionTimeDays: 0, departmentEfficiency: [], delayCausesBreakdown: [] };
    }
  },

  // EXPORT ENGINE (EXCEL / PDF)
  exportReport: async (category, type, format = 'excel') => {
    if (format === 'pdf') {
      const { downloadPdfDocument } = await import('../utils/pdfGenerator');
      downloadPdfDocument({
        title: `DOORBIN ${category.toUpperCase()} REPORT`,
        documentNumber: `REP-${Date.now().toString().slice(-6)}`,
        clientName: 'Doorbin Visuals Executive Management',
        projectTitle: `System Analytical Summary (${category})`,
        date: new Date().toLocaleDateString(),
        items: [
          { description: `${category.toUpperCase()} Performance Metric Summary Pass`, qty: 1, rate: 0 }
        ],
        totalAmount: 0,
        status: 'Generated'
      });
      return { success: true };
    }
    try {
      const response = await apiClient.get('/reports/export', {
        params: { category, type, format },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Doorbin_${category}_Report.${format === 'excel' ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      return { success: true };
    } catch (err) {
      console.warn('Error triggering export report download:', err.message);
      return { success: false, message: err.message };
    }
  },

  // SCHEDULED REPORTS API
  getScheduledReports: async () => {
    try {
      const response = await apiClient.get('/reports/scheduled');
      return extractArray(response.data, 'scheduledReports');
    } catch (err) {
      console.warn('Error fetching scheduled reports:', err.message);
      return [];
    }
  },

  createScheduledReport: async (scheduleData) => {
    const response = await apiClient.post('/reports/scheduled', scheduleData);
    return response.data?.data || response.data;
  },

  updateScheduledReport: async (id, scheduleData) => {
    const response = await apiClient.put(`/reports/scheduled/${id}`, scheduleData);
    return response.data?.data || response.data;
  },

  deleteScheduledReport: async (id) => {
    const response = await apiClient.delete(`/reports/scheduled/${id}`);
    return response.data;
  }
};
