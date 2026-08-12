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

const DEFAULT_QUOTATIONS = [];
const DEFAULT_INVOICES = [];
const DEFAULT_PAYMENTS = [];
const DEFAULT_AGEING = { totalOutstanding: 0, ageingBuckets: { current_0_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 }, overdueClientsCount: 0 };
const DEFAULT_CASHFLOW = { totalBilledYTD: 0, totalCollectedYTD: 0, totalPendingYTD: 0, monthlyRevenueTrend: [] };

/**
 * Finance Service managing Module 9: Quotations, Invoices, Payments, Receivables Ageing, Cashflow & Turnover
 */
export const financeService = {
  // QUOTATIONS API
  getQuotations: async (params = {}) => {
    try {
      const response = await apiClient.get('/finance/quotations', { params });
      return extractArray(response.data, 'quotations');
    } catch (err) {
      console.warn('Error fetching quotations:', err.message);
      return [];
    }
  },

  createQuotation: async (quotationData) => {
    const response = await apiClient.post('/finance/quotations', quotationData);
    return response.data?.data || response.data;
  },

  updateQuotation: async (id, quotationData) => {
    const response = await apiClient.put(`/finance/quotations/${id}`, quotationData);
    return response.data?.data || response.data;
  },

  deleteQuotation: async (id) => {
    const response = await apiClient.delete(`/finance/quotations/${id}`);
    return response.data;
  },

  // INVOICES API
  getInvoices: async (params = {}) => {
    try {
      const response = await apiClient.get('/finance/invoices', { params });
      return extractArray(response.data, 'invoices');
    } catch (err) {
      console.warn('Error fetching invoices:', err.message);
      return [];
    }
  },

  createInvoice: async (invoiceData) => {
    const response = await apiClient.post('/finance/invoices', invoiceData);
    return response.data?.data || response.data;
  },

  // PAYMENTS LOG API
  getPayments: async (params = {}) => {
    try {
      const response = await apiClient.get('/finance/payments', { params });
      return extractArray(response.data, 'payments');
    } catch (err) {
      console.warn('Error fetching payments:', err.message);
      return [];
    }
  },

  recordPayment: async (paymentData) => {
    const response = await apiClient.post('/finance/payments', paymentData);
    return response.data?.data || response.data;
  },

  // RECEIVABLES AGEING ANALYSIS
  getReceivablesAgeing: async () => {
    try {
      const response = await apiClient.get('/finance/due-payments');
      return response.data?.data || response.data;
    } catch {
      try {
        const fallbackRes = await apiClient.get('/finance/receivables-ageing');
        return fallbackRes.data?.data || fallbackRes.data;
      } catch {
        return DEFAULT_AGEING;
      }
    }
  },

  // CASHFLOW & TURNOVER OVERVIEW
  getCashflowTurnover: async () => {
    try {
      const response = await apiClient.get('/finance/cashflow');
      return response.data?.data || response.data;
    } catch {
      return DEFAULT_CASHFLOW;
    }
  }
};
