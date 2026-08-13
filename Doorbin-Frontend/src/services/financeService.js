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
    const client = typeof quotationData.client === 'object' ? quotationData.client?._id : (quotationData.clientId || quotationData.client);
    const project = typeof quotationData.project === 'object' ? quotationData.project?._id : (quotationData.projectId || quotationData.project);
    const amount = Number(quotationData.amount || quotationData.subtotal || quotationData.itemRate || 0);

    const payload = {
      client,
      project: project && /^[0-9a-fA-F]{24}$/.test(project) ? project : undefined,
      amount,
      notes: quotationData.notes
    };
    const response = await apiClient.post('/finance/quotations', payload);
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
    const client = typeof invoiceData.client === 'object' ? invoiceData.client?._id : (invoiceData.clientId || invoiceData.client);
    const project = typeof invoiceData.project === 'object' ? invoiceData.project?._id : (invoiceData.projectId || invoiceData.project);
    const amount = Number(invoiceData.amount || invoiceData.subtotal || 0);
    const gstRate = Number(invoiceData.gstRate || invoiceData.gstPercentage || 18);

    const dueDays = Number(invoiceData.dueDateDays || 15);
    const issueDate = invoiceData.issueDate || invoiceData.invoiceDate || new Date().toISOString();
    const dueDate = invoiceData.dueDate || new Date(Date.now() + dueDays * 86400000).toISOString();

    const payload = {
      client,
      project,
      amount,
      gstRate,
      issueDate,
      dueDate
    };
    const response = await apiClient.post('/finance/invoices', payload);
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
    const invoice = typeof paymentData.invoice === 'object' ? paymentData.invoice?._id : (paymentData.invoiceId || paymentData.invoice);
    let rawMode = paymentData.paymentMode || paymentData.mode || 'Bank Transfer';
    let paymentMode = 'Bank Transfer';
    if (rawMode.includes('Cash')) paymentMode = 'Cash';
    else if (rawMode.includes('Cheque')) paymentMode = 'Cheque';
    else if (rawMode.includes('UPI')) paymentMode = 'UPI';
    else if (rawMode.includes('Other')) paymentMode = 'Other';

    const payload = {
      invoice,
      amountPaid: Number(paymentData.amountPaid || 0),
      paymentMode,
      referenceNumber: paymentData.transactionReference || paymentData.referenceNumber || '',
      notes: paymentData.remarks || paymentData.notes || ''
    };
    const response = await apiClient.post('/finance/payments', payload);
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
