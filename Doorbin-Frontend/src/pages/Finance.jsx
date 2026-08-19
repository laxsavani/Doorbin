import React, { useState, useEffect } from 'react';
import { financeService } from '../services/financeService';
import { clientService } from '../services/clientService';
import { projectService } from '../services/projectService';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { formatDate } from '../utils/dateUtils';
import { downloadPdfDocument } from '../utils/pdfGenerator';
import { reportService } from '../services/reportService';
import {
  FileText,
  IndianRupee,
  Plus,
  CreditCard,
  TrendingUp,
  PieChart,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Download,
  Trash2,
  Edit,
  LayoutGrid,
  List,
  FileSpreadsheet,
  Calendar,
  Loader2
} from 'lucide-react';
import { useViewMode } from '../hooks/useViewMode';
import { Pagination } from '../components/Pagination';
import { MilestoneTrackerTab } from '../components/MilestoneTrackerTab';
import { exportFinanceTabData } from '../utils/financeExportUtils';
import './Dashboard.css';

export const Finance = () => {
  const [financePage, setFinancePage] = useState(1);
  const pageSize = 10;
  const [activeTab, setActiveTab] = useState('milestones'); // 'quotations' | 'invoices' | 'payments' | 'ageing'
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [viewMode, setViewMode] = useViewMode();

  // Data states
  const [quotations, setQuotations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [ageingData, setAgeingData] = useState(null);
  const [cashflowData, setCashflowData] = useState(null);
  const [clientsRoster, setClientsRoster] = useState([]);
  const [projectsRoster, setProjectsRoster] = useState([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFY, setSelectedFY] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'this_month' | 'last_month' | 'custom'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modal states
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Form states
  const [quoteForm, setQuoteForm] = useState({
    clientId: '',
    projectTitle: '',
    validDays: 30,
    itemDesc: '',
    itemRate: '',
    gstPercentage: 18,
    notes: ''
  });

  const [invoiceForm, setInvoiceForm] = useState({
    clientId: '',
    projectId: '',
    milestoneName: '',
    subtotal: '',
    gstPercentage: 18,
    dueDateDays: 15
  });

  const [paymentForm, setPaymentForm] = useState({
    invoiceId: '',
    amountPaid: '',
    paymentMode: 'Bank Transfer / NEFT',
    transactionReference: '',
    remarks: ''
  });

  useEffect(() => {
    loadFinanceData();
  }, []);

  useEffect(() => {
    setFinancePage(1);
  }, [activeTab, dateFilter, fromDate, toDate]);

  
  // Helper: Filter record by Financial Year (Apr 1 - Mar 31)
  const matchesFinancialYear = (dateVal, fy) => {
    if (!fy || fy === 'ALL' || !dateVal) return true;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return true;
    const y = d.getFullYear();
    const m = d.getMonth() + 1; // 1-12
    const recordFY = m >= 4 ? `FY ${y}-${(y + 1).toString().slice(-2)}` : `FY ${y - 1}-${y.toString().slice(-2)}`;
    return recordFY === fy;
  };

  const loadFinanceData = async () => {
    setLoading(true);
    try {
      const [quotesData, invsData, pmtsData, ageData, cashData, clientsData, projsData] = await Promise.all([
        financeService.getQuotations(),
        financeService.getInvoices(),
        financeService.getPayments(),
        financeService.getReceivablesAgeing(),
        financeService.getCashflowTurnover(),
        clientService.getClients(),
        projectService.getProjects()
      ]);

      setQuotations(quotesData || []);
      setInvoices(invsData || []);
      setPayments(pmtsData || []);
      setAgeingData(ageData);
      setCashflowData(cashData);
      setClientsRoster(clientsData || []);
      setProjectsRoster(projsData || []);
    } catch (err) {
      setToast({ message: 'Failed to load finance records', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Create Quotation Handler
  const handleCreateQuotation = async (e) => {
    e.preventDefault();
    if (!quoteForm.clientId || !quoteForm.projectTitle || !quoteForm.itemRate) {
      setToast({ message: 'Please complete required quotation fields', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const selectedClient = safeClients.find(c => c._id === quoteForm.clientId);
      const selectedProject = safeProjects.find(p => p._id === quoteForm.projectId || p.projectName === quoteForm.projectTitle);

      const newQuote = await financeService.createQuotation({
        client: selectedClient ? selectedClient._id : quoteForm.clientId,
        project: selectedProject ? selectedProject._id : undefined,
        projectTitle: quoteForm.projectTitle,
        amount: Number(quoteForm.itemRate),
        notes: quoteForm.notes
      });

      setIsQuotationModalOpen(false);
      setToast({ message: `Quotation ${newQuote.quotationNumber || 'created'} successfully!`, type: 'success' });
      setQuoteForm({ clientId: '', projectId: '', projectTitle: '', validDays: 30, itemDesc: '', itemRate: '', gstPercentage: 18, notes: '' });
      await loadFinanceData();
    } catch (err) {
      setToast({ message: err.message || 'Failed to create quotation', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Create Invoice Handler
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceForm.clientId || !invoiceForm.projectId || !invoiceForm.subtotal) {
      setToast({ message: 'Please select a Client, Project, and enter Subtotal amount', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const newInvoice = await financeService.createInvoice({
        clientId: invoiceForm.clientId,
        projectId: invoiceForm.projectId,
        milestoneName: invoiceForm.milestoneName || 'Project Milestone',
        subtotal: Number(invoiceForm.subtotal),
        gstPercentage: Number(invoiceForm.gstPercentage || 18),
        dueDateDays: Number(invoiceForm.dueDateDays || 15)
      });

      setIsInvoiceModalOpen(false);
      setToast({ message: `Invoice ${newInvoice.invoiceNumber || 'created'} successfully!`, type: 'success' });
      setInvoiceForm({ clientId: '', projectId: '', milestoneName: '', subtotal: '', gstPercentage: 18, dueDateDays: 15 });
      await loadFinanceData();
    } catch (err) {
      setToast({ message: err.message || 'Failed to create invoice', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Record Payment Handler
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.invoiceId || !paymentForm.amountPaid) {
      setToast({ message: 'Please select an invoice and enter amount', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const newPayment = await financeService.recordPayment({
        invoiceId: paymentForm.invoiceId,
        amountPaid: Number(paymentForm.amountPaid),
        paymentMode: paymentForm.paymentMode,
        transactionReference: paymentForm.transactionReference,
        remarks: paymentForm.remarks
      });

      setIsPaymentModalOpen(false);
      setToast({ message: `Payment receipt recorded successfully!`, type: 'success' });
      setPaymentForm({ invoiceId: '', amountPaid: '', paymentMode: 'Bank Transfer / NEFT', transactionReference: '', remarks: '' });
      await loadFinanceData();
    } catch (err) {
      setToast({ message: err.message || 'Failed to record payment', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetQuotationForm = () => {
    setQuoteForm({ clientId: '', projectId: '', projectTitle: '', validDays: 30, itemDesc: '', itemRate: '', gstPercentage: 18, notes: '' });
    setIsQuotationModalOpen(false);
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({ clientId: '', projectId: '', milestoneName: '', subtotal: '', gstPercentage: 18, dueDateDays: 15 });
    setIsInvoiceModalOpen(false);
  };

  const resetPaymentForm = () => {
    setPaymentForm({ invoiceId: '', amountPaid: '', paymentMode: 'Bank Transfer / NEFT', transactionReference: '', remarks: '' });
    setIsPaymentModalOpen(false);
  };

  const handleDeleteQuotation = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quotation?')) return;
    try {
      await financeService.deleteQuotation(id);
      setQuotations(prev => prev.filter(q => q._id !== id));
      setToast({ message: 'Quotation deleted successfully', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete quotation', type: 'error' });
    }
  };

  const handleDeleteInvoice = async (id) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      setInvoices(prev => prev.filter(inv => inv._id !== id));
      setToast({ message: 'Invoice deleted successfully', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete invoice', type: 'error' });
    }
  };

  if (loading) {
    return <Loader message="Loading Module 9: Finance Management..." />;
  }

  // Defensive array guards
  const safeQuotations = Array.isArray(quotations) ? quotations : [];
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeClients = Array.isArray(clientsRoster) ? clientsRoster : [];
  const safeProjects = Array.isArray(projectsRoster) ? projectsRoster : [];

  // Date Filter Logic
  const filterByDate = (item, dateField) => {
    if (dateFilter === 'all') return true;
    const rawVal = item[dateField] || item.createdAt || item.issueDate || item.paymentDate || item.date || item.quotationDate;
    if (!rawVal) return true;
    const d = new Date(rawVal);
    const now = new Date();

    if (dateFilter === 'today') {
      return d.toDateString() === now.toDateString();
    }
    if (dateFilter === 'this_month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (dateFilter === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
    }
    if (dateFilter === 'custom') {
      let match = true;
      if (fromDate) match = match && d >= new Date(fromDate);
      if (toDate) match = match && d <= new Date(toDate + 'T23:59:59');
      return match;
    }
    return true;
  };

  const filteredQuotations = safeQuotations.filter(q => filterByDate(q, 'quotationDate'));
  const filteredInvoices = safeInvoices.filter(i => filterByDate(i, 'issueDate'));
  const filteredPayments = safePayments.filter(p => filterByDate(p, 'paymentDate'));

  const paginatedQuotations = filteredQuotations.slice((financePage - 1) * pageSize, financePage * pageSize);
  const paginatedInvoices = filteredInvoices.slice((financePage - 1) * pageSize, financePage * pageSize);
  const paginatedPayments = filteredPayments.slice((financePage - 1) * pageSize, financePage * pageSize);

  // Calculate metrics
  const totalInvoiced = filteredInvoices.reduce((sum, i) => sum + (i?.totalAmount || i?.amount || 0), 0);
  const totalCollected = filteredPayments.reduce((sum, p) => sum + (p?.amountPaid || 0), 0);
  const totalOutstanding = filteredInvoices.reduce((sum, i) => {
    const paid = i?.paidAmount !== undefined ? i.paidAmount : (i?.status === 'Paid' ? (i?.totalAmount || 0) : 0);
    const tot = i?.totalAmount || i?.amount || 0;
    const due = i?.remainingBalance !== undefined ? i.remainingBalance : Math.max(0, tot - paid);
    return sum + due;
  }, 0);

  const handleExportFinance = async (format) => {
    try {
      if (activeTab === 'quotations') {
        if (format === 'pdf') {
          const items = filteredQuotations.map(q => ({
            description: `${q.quotationNumber || 'DV/Q/001'} - ${q.client?.companyName || q.clientName || 'Client'} (${q.projectTitle || 'Project'}) [Status: ${q.status || 'Draft'}]`,
            qty: 1,
            rate: q.totalAmount || (q.itemRate ? Math.round(q.itemRate * 1.18) : 1180000)
          }));
          downloadPdfDocument({
            title: 'QUOTATIONS EXECUTIVE REPORT',
            documentNumber: `REP-QTN-${Date.now().toString().slice(-6)}`,
            clientName: 'Doorbin Visuals Finance Division',
            projectTitle: `Quotations Overview (${filteredQuotations.length} Records - Filter: ${dateFilter.toUpperCase()})`,
            date: new Date().toLocaleDateString(),
            items: items.length > 0 ? items : [{ description: 'General Client Quotation Record', qty: 1, rate: 1180000 }],
            totalAmount: items.reduce((acc, i) => acc + i.rate, 0),
            status: 'Generated'
          });
        } else {
          let csvData = `Doorbin Visuals - QUOTATIONS REPORT (${dateFilter.toUpperCase()})\nGenerated Date: ${new Date().toLocaleString()}\n\n`;
          csvData += `Quotation Number,Client Name,Project Title,Subtotal (INR),GST (18%),Total Amount (INR),Status\n`;
          filteredQuotations.forEach(q => {
            const sub = q.subtotal || q.itemRate || 1000000;
            const gst = q.gstAmount || Math.round(sub * 0.18);
            const tot = q.totalAmount || (sub + gst);
            csvData += `"${q.quotationNumber || 'DV/Q/001'}","${q.client?.companyName || q.clientName || 'N/A'}","${q.projectTitle || 'N/A'}",${sub},${gst},${tot},"${q.status || 'Draft'}"\n`;
          });
          const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `Doorbin_Quotations_Report_${Date.now()}.csv`);
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        setToast({ message: `Quotations exported (${format.toUpperCase()}) successfully!`, type: 'success' });
        return;
      }

      if (activeTab === 'invoices') {
        if (format === 'pdf') {
          const items = filteredInvoices.map(inv => ({
            description: `Invoice ${inv.invoiceNumber} - ${inv.client?.companyName || inv.clientName || 'Client'} (${inv.project?.projectName || inv.milestoneName || 'Project'}) [Due: ₹${inv.remainingBalance || 0}]`,
            qty: 1,
            rate: inv.totalAmount || inv.amount || 0
          }));
          downloadPdfDocument({
            title: 'TAX INVOICES EXECUTIVE REPORT',
            documentNumber: `REP-INV-${Date.now().toString().slice(-6)}`,
            clientName: 'Doorbin Visuals Billing Division',
            projectTitle: `Invoices Summary (${filteredInvoices.length} Invoices - Filter: ${dateFilter.toUpperCase()})`,
            date: new Date().toLocaleDateString(),
            items: items.length > 0 ? items : [{ description: 'General Invoices Summary Record', qty: 1, rate: 500000 }],
            totalAmount: items.reduce((acc, i) => acc + i.rate, 0),
            status: 'Generated'
          });
        } else {
          let csvData = `Doorbin Visuals - TAX INVOICES REPORT (${dateFilter.toUpperCase()})\nGenerated Date: ${new Date().toLocaleString()}\n\n`;
          csvData += `Invoice Number,Client Name,Project / Milestone,Issue Date,Due Date,Total Amount (INR),Paid Amount (INR),Remaining Due (INR),Status\n`;
          filteredInvoices.forEach(inv => {
            const paid = inv.paidAmount !== undefined ? inv.paidAmount : (inv.status === 'Paid' ? (inv.totalAmount || 0) : 0);
            const due = inv.remainingBalance !== undefined ? inv.remainingBalance : Math.max(0, (inv.totalAmount || inv.amount || 0) - paid);
            csvData += `"${inv.invoiceNumber}","${inv.client?.companyName || inv.clientName || 'N/A'}","${inv.project?.projectName || inv.milestoneName || 'N/A'}","${inv.issueDateFormatted || ''}","${inv.dueDateFormatted || ''}",${inv.totalAmount || inv.amount || 0},${paid},${due},"${inv.status}"\n`;
          });
          const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `Doorbin_Invoices_Report_${Date.now()}.csv`);
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        setToast({ message: `Invoices exported (${format.toUpperCase()}) successfully!`, type: 'success' });
        return;
      }

      if (activeTab === 'payments') {
        if (format === 'pdf') {
          const items = filteredPayments.map(p => ({
            description: `Receipt ${p.receiptNumber || 'REC-001'} (Inv: ${p.invoice?.invoiceNumber || p.invoiceNumber || 'N/A'}) - ${p.client?.companyName || 'Client'} [Mode: ${p.paymentMode || 'Bank Transfer'}]`,
            qty: 1,
            rate: p.amountPaid || p.amount || 0
          }));
          downloadPdfDocument({
            title: 'PAYMENT RECEIPTS REPORT',
            documentNumber: `REP-PMT-${Date.now().toString().slice(-6)}`,
            clientName: 'Doorbin Visuals Accounts',
            projectTitle: `Payment Receipts Summary (${filteredPayments.length} Receipts - Filter: ${dateFilter.toUpperCase()})`,
            date: new Date().toLocaleDateString(),
            items: items.length > 0 ? items : [{ description: 'Payment Realized Record', qty: 1, rate: 500000 }],
            totalAmount: items.reduce((acc, i) => acc + i.rate, 0),
            status: 'Completed',
            isPaymentReceipt: true
          });
        } else {
          let csvData = `Doorbin Visuals - PAYMENT RECEIPTS REPORT (${dateFilter.toUpperCase()})\nGenerated Date: ${new Date().toLocaleString()}\n\n`;
          csvData += `Receipt Number,Invoice Reference,Client Name,Payment Date,Payment Mode,Reference / Cheque No,Amount Paid (₹)\n`;
          filteredPayments.forEach(p => {
            csvData += `"${p.receiptNumber || 'REC-001'}","${p.invoice?.invoiceNumber || p.invoiceNumber || 'N/A'}","${p.client?.companyName || 'N/A'}","${p.paymentDateFormatted || ''}","${p.paymentMode || 'Bank Transfer'}","${p.referenceNumber || 'N/A'}",${p.amountPaid || 0}\n`;
          });
          const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `Doorbin_Payments_Report_${Date.now()}.csv`);
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        setToast({ message: `Payments exported (${format.toUpperCase()}) successfully!`, type: 'success' });
        return;
      }

      // Default / Ageing Tab
      await reportService.exportReport('finance', 'all', format);
      setToast({ message: `Finance Report exported (${format.toUpperCase()}) successfully!`, type: 'success' });
    } catch (err) {
      console.error('Error exporting finance report:', err);
      setToast({ message: 'Failed to export finance report', type: 'error' });
    }
  };

  return (
    <div className="main-content smooth-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER BAR */}
      <div className="page-header-responsive">
        <div className="page-header-title-block">
          <h1 style={{ fontSize: '2rem', color: 'var(--color-secondary)', margin: 0 }}>
            Finance & Billing Management
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Quotations, milestone invoicing, GST calculation, payments & receivables ageing
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
            <button className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }} onClick={() => setIsQuotationModalOpen(true)}>
              <Plus size={15} /> New Quotation
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }} onClick={() => setIsInvoiceModalOpen(true)}>
              <FileText size={15} /> Raise Invoice
            </button>
            <button className="btn btn-primary" style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }} onClick={() => setIsPaymentModalOpen(true)}>
              <CreditCard size={15} /> Record Payment
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-title">TOTAL BILLED YTD</div>
            <div className="stat-card-icon" style={{ backgroundColor: 'rgba(182, 141, 64, 0.1)', color: 'var(--color-primary)' }}>
              <FileText size={20} />
            </div>
          </div>
          <div className="stat-card-value">₹{(totalInvoiced / 100000).toFixed(2)} L</div>
          <div className="stat-card-subtext">{safeInvoices.length} Invoices generated</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-title">TOTAL COLLECTED</div>
            <div className="stat-card-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
              <IndianRupee size={20} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>
            ₹{(totalCollected / 100000).toFixed(2)} L
          </div>
          <div className="stat-card-subtext">{safePayments.length} Payments cleared</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-title">OUTSTANDING RECEIVABLES</div>
            <div className="stat-card-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}>
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--color-danger)' }}>
            ₹{(totalOutstanding / 100000).toFixed(2)} L
          </div>
          <div className="stat-card-subtext">Due across active clients</div>
        </div>
      </div>

      {/* NAVIGATION TABS & DATE FILTER TOOLBAR */}
      <div className="responsive-filter-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        {/* Desktop Tabs */}
        <div className="desktop-tabs-container">
          <button
            onClick={() => setActiveTab('milestones')}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'milestones' ? '3px solid var(--color-primary)' : 'none',
              fontWeight: activeTab === 'milestones' ? '600' : '400',
              color: activeTab === 'milestones' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <FileSpreadsheet size={16} /> Milestone Payment Tracker
          </button>

          <button
            onClick={() => setActiveTab('quotations')}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'quotations' ? '3px solid var(--color-primary)' : 'none',
              fontWeight: activeTab === 'quotations' ? '600' : '400',
              color: activeTab === 'quotations' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer'
            }}
          >
            Quotations ({filteredQuotations.length})
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'invoices' ? '3px solid var(--color-primary)' : 'none',
              fontWeight: activeTab === 'invoices' ? '600' : '400',
              color: activeTab === 'invoices' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer'
            }}
          >
            Invoices ({filteredInvoices.length})
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'payments' ? '3px solid var(--color-primary)' : 'none',
              fontWeight: activeTab === 'payments' ? '600' : '400',
              color: activeTab === 'payments' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer'
            }}
          >
            Payments ({filteredPayments.length})
          </button>

          <button
            onClick={() => setActiveTab('ageing')}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'ageing' ? '3px solid var(--color-primary)' : 'none',
              fontWeight: activeTab === 'ageing' ? '600' : '400',
              color: activeTab === 'ageing' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer'
            }}
          >
            Ageing Analysis
          </button>
        </div>

        {/* Mobile Filter Select Dropdown */}
        <select
          className="mobile-filter-select"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
        >
          <option value="milestones">Milestone Payment Tracker</option>
          <option value="quotations">Quotations ({filteredQuotations.length})</option>
          <option value="invoices">Invoices ({filteredInvoices.length})</option>
          <option value="payments">Payments ({filteredPayments.length})</option>
          <option value="ageing">Receivables Ageing</option>
        </select>

        {/* Date Filter & Dual View Toggle */}
        {activeTab !== 'milestones' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#ffffff', border: '1px solid #dcd8cf', borderRadius: '10px', padding: '0.35rem 0.75rem' }}>
            <Calendar size={14} style={{ color: 'var(--color-primary)' }} />
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.825rem', fontWeight: '600', color: 'var(--color-secondary)', cursor: 'pointer' }}
            >
              <option value="all">📅 All Time</option>
              <option value="today">📆 Today</option>
              <option value="this_month">📅 This Month</option>
              <option value="last_month">📅 Last Month</option>
              <option value="custom">🗓️ Custom Date Range</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#ffffff', padding: '0.25rem 0.5rem', borderRadius: '8px', border: '1px solid #dcd8cf' }}>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                style={{ padding: '0.25rem 0.4rem', borderRadius: '6px', border: '1px solid #dcd8cf', fontSize: '0.78rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>to</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                style={{ padding: '0.25rem 0.4rem', borderRadius: '6px', border: '1px solid #dcd8cf', fontSize: '0.78rem' }}
              />
            </div>
          )}

          <div className="view-toggle-container">
            <button
              className={`view-toggle-btn ${viewMode === 'stripe' ? 'active' : ''}`}
              onClick={() => setViewMode('stripe')}
            >
              <List size={14} /> Stripe View
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid size={14} /> Card View
            </button>
          </div>

          {/* Export Action Buttons (Item 7.1) */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => {
                exportFinanceTabData(activeTab, 'excel', { quotations: filteredQuotations, invoices: filteredInvoices, payments: filteredPayments, ageingData });
                setToast({ message: `Exporting ${activeTab.toUpperCase()} data to Excel...`, type: 'success' });
              }}
            >
              <FileSpreadsheet size={14} color="#15803d" /> Excel
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => {
                exportFinanceTabData(activeTab, 'pdf', { quotations: filteredQuotations, invoices: filteredInvoices, payments: filteredPayments, ageingData });
                setToast({ message: `Exporting ${activeTab.toUpperCase()} report to PDF...`, type: 'success' });
              }}
            >
              <FileText size={14} color="#dc2626" /> PDF
            </button>
          </div>
        </div>
      )}
    </div>

      {/* TAB CONTENT 0: MILESTONE PAYMENT TRACKER */}
      {activeTab === 'milestones' && <MilestoneTrackerTab setToast={setToast} />}

      {/* TAB CONTENT 1: QUOTATIONS */}
      {activeTab === 'quotations' && (
        viewMode === 'card' ? (
          <div className="responsive-cards-grid">
            {paginatedQuotations.map(q => (
              <div key={q._id} className="responsive-card-item">
                <div className="responsive-card-header">
                  <div>
                    <div className="responsive-card-title">{q.quotationNumber}</div>
                    <div className="responsive-card-subtitle">{q.client?.companyName || q.client?.clientName}</div>
                  </div>
                  <span className={`badge ${q.status === 'Approved' ? 'badge-success' : q.status === 'Sent' ? 'badge-warning' : 'badge-secondary'}`}>
                    {q.status}
                  </span>
                </div>
                <div className="responsive-card-body">
                  <div><strong>Project:</strong> {q.projectTitle}</div>
                  <div><strong>Subtotal:</strong> ₹{q.subtotal?.toLocaleString('en-IN')}</div>
                  <div><strong>GST (18%):</strong> ₹{q.gstAmount?.toLocaleString('en-IN')}</div>
                  <div><strong>Total Amount:</strong> <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>₹{q.totalAmount?.toLocaleString('en-IN')}</span></div>
                </div>
                <div className="responsive-card-footer">
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    onClick={() => downloadPdfDocument({
                      title: 'OFFICIAL QUOTATION',
                      documentNumber: q.quotationNumber,
                      clientName: q.client?.companyName || q.client?.clientName,
                      clientGstin: q.client?.gstin || '24ABCDE1234F1Z2',
                      projectTitle: q.projectTitle,
                      date: formatDate(q.quotationDate || q.createdAt),
                      dueDate: formatDate(q.validUntil),
                      items: q.items,
                      subtotal: q.subtotal,
                      gstAmount: q.gstAmount,
                      totalAmount: q.totalAmount,
                      status: q.status
                    })}
                  >
                    <Download size={12} /> Download PDF
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fecaca' }}
                    onClick={() => handleDeleteQuotation(q._id)}
                    title="Delete Quotation"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>QUOTATION #</th>
                  <th style={{ textAlign: 'center' }}>CLIENT NAME</th>
                  <th style={{ textAlign: 'center' }}>PROJECT TITLE</th>
                  <th style={{ textAlign: 'center' }}>SUBTOTAL</th>
                  <th style={{ textAlign: 'center' }}>GST (18%)</th>
                  <th style={{ textAlign: 'center' }}>TOTAL AMOUNT</th>
                  <th style={{ textAlign: 'center' }}>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedQuotations.map(q => {
                  const qNum = q.quotationNumber || q.quotationNo || 'Q-001';
                  const clientName = q.client?.companyName || q.client?.clientName || q.clientName || 'N/A';
                  const projTitle = q.project?.projectName || q.projectTitle || q.projectCategory || 'General Project';
                  const subtotal = q.amount || q.subtotal || 0;
                  const gst = q.gst || q.gstAmount || Math.round(subtotal * 0.18);
                  const total = q.totalAmount || (subtotal + gst);

                  return (
                    <tr key={q._id}>
                      <td style={{ textAlign: 'left', fontWeight: '600', color: 'var(--color-primary)' }}>{qNum}</td>
                      <td style={{ textAlign: 'center' }}>{clientName}</td>
                      <td style={{ textAlign: 'center' }}>{projTitle}</td>
                      <td style={{ textAlign: 'center' }}>₹{subtotal.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'center' }}>₹{gst.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'center', fontWeight: '600' }}>₹{total.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${q.status === 'Accepted' || q.status === 'Approved' ? 'badge-success' : q.status === 'Sent' ? 'badge-warning' : 'badge-secondary'}`}>
                          {q.status || 'Draft'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            onClick={() => downloadPdfDocument({
                              title: 'OFFICIAL QUOTATION',
                              documentNumber: qNum,
                              clientName,
                              clientGstin: q.client?.gstin || '24ABCDE1234F1Z2',
                              projectTitle: projTitle,
                              date: q.dateFormatted || formatDate(q.date || q.createdAt),
                              dueDate: q.validTillFormatted || formatDate(q.validTill),
                              items: [{ description: projTitle, qty: 1, rate: subtotal }],
                              subtotal,
                              gstAmount: gst,
                              totalAmount: total,
                              status: q.status
                            })}
                          >
                            <Download size={12} /> PDF
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fecaca' }}
                            onClick={() => handleDeleteQuotation(q._id)}
                            title="Delete Quotation"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* TAB CONTENT 2: INVOICES */}
      {activeTab === 'invoices' && (
        viewMode === 'card' ? (
          <div className="responsive-cards-grid">
            {paginatedInvoices.map(inv => (
              <div key={inv._id} className="responsive-card-item">
                <div className="responsive-card-header">
                  <div>
                    <div className="responsive-card-title">{inv.invoiceNumber}</div>
                    <div className="responsive-card-subtitle">{inv.client?.companyName || inv.client?.clientName}</div>
                  </div>
                  <span className={`badge ${inv.status === 'Paid' ? 'badge-success' : inv.status === 'Partially Paid' ? 'badge-warning' : 'badge-danger'}`}>
                    {inv.status}
                  </span>
                </div>
                <div className="responsive-card-body">
                  <div><strong>Milestone:</strong> {inv.milestoneName}</div>
                  <div><strong>Due Date:</strong> {formatDate(inv.dueDate)}</div>
                  <div><strong>Total Invoiced:</strong> ₹{inv.totalAmount?.toLocaleString('en-IN')}</div>
                  <div><strong>Paid Amount:</strong> <span style={{ color: 'var(--color-success)' }}>₹{inv.paidAmount?.toLocaleString('en-IN')}</span></div>
                  <div><strong>Due Balance:</strong> <span style={{ color: inv.dueBalance > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: 700 }}>₹{inv.dueBalance?.toLocaleString('en-IN')}</span></div>
                </div>
                <div className="responsive-card-footer">
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    onClick={() => downloadPdfDocument({
                      title: 'OFFICIAL TAX INVOICE',
                      documentNumber: inv.invoiceNumber,
                      clientName: inv.client?.companyName || inv.client?.clientName,
                      clientGstin: inv.client?.gstin || '24ABCDE1234F1Z2',
                      projectTitle: inv.milestoneName,
                      date: formatDate(inv.createdAt || new Date()),
                      dueDate: formatDate(inv.dueDate),
                      items: [{ description: inv.milestoneName, qty: 1, rate: Math.round(inv.totalAmount / 1.18) }],
                      subtotal: Math.round(inv.totalAmount / 1.18),
                      gstAmount: Math.round(inv.totalAmount - (inv.totalAmount / 1.18)),
                      totalAmount: inv.totalAmount,
                      status: inv.status
                    })}
                  >
                    <Download size={12} /> Download PDF
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fecaca' }}
                    onClick={() => handleDeleteInvoice(inv._id)}
                    title="Delete Invoice"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>INVOICE #</th>
                  <th style={{ textAlign: 'center' }}>CLIENT</th>
                  <th style={{ textAlign: 'center' }}>MILESTONE</th>
                  <th style={{ textAlign: 'center' }}>DUE DATE</th>
                  <th style={{ textAlign: 'center' }}>TOTAL INVOICED</th>
                  <th style={{ textAlign: 'center' }}>PAID</th>
                  <th style={{ textAlign: 'center' }}>DUE BALANCE</th>
                  <th style={{ textAlign: 'center' }}>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices.map(inv => {
                  const invNum = inv.invoiceNumber || 'INV-001';
                  const clientName = inv.client?.companyName || inv.client?.clientName || 'N/A';
                  const milestone = inv.project?.projectName || inv.milestoneName || 'Milestone Services';
                  const total = inv.totalAmount || inv.amount || 0;
                  const paid = inv.paidAmount !== undefined ? inv.paidAmount : (inv.status === 'Paid' ? total : 0);
                  const due = inv.remainingBalance !== undefined ? inv.remainingBalance : Math.max(0, total - paid);
                  const dueD = inv.dueDateFormatted || formatDate(inv.dueDate);

                  return (
                    <tr key={inv._id}>
                      <td style={{ textAlign: 'left', fontWeight: '600', color: 'var(--color-secondary)' }}>{invNum}</td>
                      <td style={{ textAlign: 'center' }}>{clientName}</td>
                      <td style={{ textAlign: 'center' }}>{milestone}</td>
                      <td style={{ textAlign: 'center' }}>{dueD}</td>
                      <td style={{ textAlign: 'center' }}>₹{total.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'center', color: 'var(--color-success)' }}>₹{paid.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'center', color: due > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: '600' }}>
                        ₹{due.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${inv.status === 'Paid' ? 'badge-success' : inv.status === 'Partially Paid' ? 'badge-warning' : 'badge-danger'}`}>
                          {inv.status || 'Pending'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            onClick={() => downloadPdfDocument({
                              title: 'OFFICIAL TAX INVOICE',
                              documentNumber: invNum,
                              clientName,
                              clientGstin: inv.client?.gstin || '24ABCDE1234F1Z2',
                              projectTitle: milestone,
                              date: inv.issueDateFormatted || formatDate(inv.issueDate || inv.createdAt),
                              dueDate: dueD,
                              items: [{ description: milestone, qty: 1, rate: Math.round(total / 1.18) }],
                              subtotal: Math.round(total / 1.18),
                              gstAmount: Math.round(total - (total / 1.18)),
                              totalAmount: total,
                              status: inv.status
                            })}
                          >
                            <Download size={12} /> PDF
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fecaca' }}
                            onClick={() => handleDeleteInvoice(inv._id)}
                            title="Delete Invoice"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* TAB CONTENT 3: PAYMENTS */}
      {activeTab === 'payments' && (
        viewMode === 'card' ? (
          <div className="responsive-cards-grid">
            {paginatedPayments.map(p => (
              <div key={p._id} className="responsive-card-item">
                <div className="responsive-card-header">
                  <div>
                    <div className="responsive-card-title">{p.receiptNumber}</div>
                    <div className="responsive-card-subtitle">{p.client?.companyName}</div>
                  </div>
                  <span className="badge badge-success">COMPLETED</span>
                </div>
                <div className="responsive-card-body">
                  <div><strong>Invoice Ref:</strong> {p.invoice?.invoiceNumber}</div>
                  <div><strong>Payment Date:</strong> {formatDate(p.paymentDate)}</div>
                  <div><strong>Payment Mode:</strong> {p.paymentMode}</div>
                  <div><strong>Transaction Ref:</strong> {p.transactionReference || 'N/A'}</div>
                  <div><strong>Amount Paid:</strong> <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>₹{p.amountPaid?.toLocaleString('en-IN')}</span></div>
                </div>
                <div className="responsive-card-footer">
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    onClick={() => downloadPdfDocument({
                      title: 'PAYMENT RECEIPT',
                      documentNumber: p.receiptNumber || p.paymentNumber || 'RCT-001',
                      clientName: p.client?.companyName || p.client?.clientName || 'Valued Client',
                      projectTitle: `Payment for Invoice ${p.invoice?.invoiceNumber || ''}`,
                      date: formatDate(p.paymentDate),
                      items: [{ description: `Payment Mode: ${p.paymentMode} (Ref: ${p.transactionReference || 'N/A'})`, qty: 1, rate: p.amountPaid }],
                      totalAmount: p.amountPaid,
                      status: 'COMPLETED',
                      isPaymentReceipt: true
                    })}
                  >
                    <Download size={12} /> Download PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>RECEIPT #</th>
                  <th style={{ textAlign: 'center' }}>INVOICE REF</th>
                  <th style={{ textAlign: 'center' }}>CLIENT</th>
                  <th style={{ textAlign: 'center' }}>PAYMENT DATE</th>
                  <th style={{ textAlign: 'center' }}>MODE</th>
                  <th style={{ textAlign: 'center' }}>REF NO.</th>
                  <th style={{ textAlign: 'center' }}>AMOUNT PAID</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.map(p => {
                  const rcpt = p.paymentNumber || p.receiptNumber || p._id?.slice(-6)?.toUpperCase() || 'RCT-001';
                  const invRef = p.invoice?.invoiceNumber || p.invoiceRef || p.invoiceNumber || 'N/A';
                  const clientName = p.client?.companyName || p.client?.clientName || 'N/A';
                  const pmtDate = p.paymentDateFormatted || formatDate(p.paymentDate || p.createdAt);
                  const mode = p.paymentMode || p.mode || 'Bank Transfer';
                  const refNo = p.referenceNumber || p.transactionReference || 'N/A';
                  const amtPaid = p.amountPaid || 0;

                  return (
                    <tr key={p._id}>
                      <td style={{ textAlign: 'left', fontWeight: '600', color: 'var(--color-primary)' }}>{rcpt}</td>
                      <td style={{ textAlign: 'center' }}>{invRef}</td>
                      <td style={{ textAlign: 'center' }}>{clientName}</td>
                      <td style={{ textAlign: 'center' }}>{pmtDate}</td>
                      <td style={{ textAlign: 'center' }}>{mode}</td>
                      <td style={{ textAlign: 'center' }}>{refNo}</td>
                      <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--color-success)' }}>₹{amtPaid.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          onClick={() => downloadPdfDocument({
                            title: 'PAYMENT RECEIPT',
                            documentNumber: rcpt,
                            clientName,
                            projectTitle: `Payment for Invoice ${invRef}`,
                            date: pmtDate,
                            items: [{ description: `Payment Mode: ${mode} (Ref: ${refNo})`, qty: 1, rate: amtPaid }],
                            totalAmount: amtPaid,
                            status: 'COMPLETED',
                            isPaymentReceipt: true
                          })}
                        >
                          <Download size={12} /> PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeTab !== 'ageing' && (
        <Pagination
          currentPage={financePage}
          totalItems={activeTab === 'quotations' ? filteredQuotations.length : (activeTab === 'invoices' ? filteredInvoices.length : filteredPayments.length)}
          pageSize={pageSize}
          onPageChange={setFinancePage}
        />
      )}

      {/* TAB CONTENT 4: RECEIVABLES AGEING ANALYSIS */}
      {activeTab === 'ageing' && (() => {
        let age0_30 = 0, age31_60 = 0, age61_90 = 0, age90_plus = 0;
        const now = new Date();
        safeInvoices.forEach(inv => {
          const paid = inv.paidAmount !== undefined ? inv.paidAmount : (inv.status === 'Paid' ? (inv.totalAmount || 0) : 0);
          const due = inv.remainingBalance !== undefined ? inv.remainingBalance : Math.max(0, (inv.totalAmount || inv.amount || 0) - paid);
          if (due <= 0) return;

          const dueDate = inv.dueDate ? new Date(inv.dueDate) : now;
          const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));

          if (diffDays <= 30) age0_30 += due;
          else if (diffDays <= 60) age31_60 += due;
          else if (diffDays <= 90) age61_90 += due;
          else age90_plus += due;
        });

        if (ageingData && ageingData.ageingBuckets) {
          age0_30 = ageingData.ageingBuckets.current_0_30 || age0_30;
          age31_60 = ageingData.ageingBuckets.days_31_60 || age31_60;
          age61_90 = ageingData.ageingBuckets.days_61_90 || age61_90;
          age90_plus = ageingData.ageingBuckets.days_90_plus || age90_plus;
        }

        const pendingDueInvoices = safeInvoices.filter(inv => {
          const paid = inv.paidAmount !== undefined ? inv.paidAmount : (inv.status === 'Paid' ? (inv.totalAmount || 0) : 0);
          const due = inv.remainingBalance !== undefined ? inv.remainingBalance : Math.max(0, (inv.totalAmount || inv.amount || 0) - paid);
          return due > 0 || inv.status !== 'Paid';
        });

        return (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div className="stat-card" style={{ borderTop: '4px solid var(--color-success)' }}>
                <div className="stat-card-title">0 - 30 DAYS (CURRENT)</div>
                <div className="stat-card-value">₹{(age0_30 / 100000).toFixed(2)} L</div>
                <div className="stat-card-subtext">Within standard credit period</div>
              </div>

              <div className="stat-card" style={{ borderTop: '4px solid var(--color-warning)' }}>
                <div className="stat-card-title">31 - 60 DAYS OVERDUE</div>
                <div className="stat-card-value" style={{ color: 'var(--color-warning)' }}>
                  ₹{(age31_60 / 100000).toFixed(2)} L
                </div>
                <div className="stat-card-subtext">First reminder notification sent</div>
              </div>

              <div className="stat-card" style={{ borderTop: '4px solid #f97316' }}>
                <div className="stat-card-title">61 - 90 DAYS OVERDUE</div>
                <div className="stat-card-value" style={{ color: '#f97316' }}>
                  ₹{(age61_90 / 100000).toFixed(2)} L
                </div>
                <div className="stat-card-subtext">Escalation required</div>
              </div>

              <div className="stat-card" style={{ borderTop: '4px solid var(--color-danger)' }}>
                <div className="stat-card-title">90+ DAYS OVERDUE</div>
                <div className="stat-card-value" style={{ color: 'var(--color-danger)' }}>
                  ₹{(age90_plus / 100000).toFixed(2)} L
                </div>
                <div className="stat-card-subtext">High risk receivables</div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>INVOICE #</th>
                    <th>CLIENT</th>
                    <th>PROJECT</th>
                    <th>DUE DATE</th>
                    <th>DAYS OVERDUE</th>
                    <th>TOTAL AMOUNT</th>
                    <th>OUTSTANDING BALANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDueInvoices.map(inv => {
                    const paid = inv.paidAmount !== undefined ? inv.paidAmount : (inv.status === 'Paid' ? (inv.totalAmount || 0) : 0);
                    const due = inv.remainingBalance !== undefined ? inv.remainingBalance : Math.max(0, (inv.totalAmount || inv.amount || 0) - paid);
                    const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date();
                    const diffDays = Math.max(0, Math.floor((new Date().getTime() - dueDate.getTime()) / (1000 * 3600 * 24)));

                    return (
                      <tr key={inv._id}>
                        <td style={{ fontWeight: '600', color: 'var(--color-secondary)' }}>{inv.invoiceNumber}</td>
                        <td>{inv.client?.companyName || inv.client?.clientName || 'N/A'}</td>
                        <td>{inv.project?.projectName || inv.milestoneName || 'General Project'}</td>
                        <td>{inv.dueDateFormatted || formatDate(inv.dueDate)}</td>
                        <td style={{ color: diffDays > 30 ? 'var(--color-danger)' : 'var(--color-warning)', fontWeight: '600' }}>{diffDays} days</td>
                        <td>₹{(inv.totalAmount || inv.amount || 0).toLocaleString('en-IN')}</td>
                        <td style={{ fontWeight: '700', color: due > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          ₹{due.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* CREATE QUOTATION MODAL */}
      {isQuotationModalOpen && (
        <Modal isOpen={isQuotationModalOpen} title="Create Client Quotation" onClose={resetQuotationForm}>
          <form onSubmit={handleCreateQuotation}>
            <FormField label="Select Client" name="clientId" type="select" value={quoteForm.clientId} onChange={e => setQuoteForm({ ...quoteForm, clientId: e.target.value })} required>
              <option value="">-- Choose Client --</option>
              {safeClients.map(c => (
                <option key={c._id} value={c._id}>{c.companyName || c.clientName}</option>
              ))}
            </FormField>

            <FormField label="Project / Proposal Title" name="projectTitle" value={quoteForm.projectTitle} onChange={e => setQuoteForm({ ...quoteForm, projectTitle: e.target.value })} placeholder="e.g. Luxury Villa 3D Walkthrough" required />

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <FormField label="Scope Item Description" name="itemDesc" value={quoteForm.itemDesc} onChange={e => setQuoteForm({ ...quoteForm, itemDesc: e.target.value })} placeholder="3D Exterior Renders & Modeling" />
              <FormField label="Item Rate (₹)" name="itemRate" type="number" value={quoteForm.itemRate} onChange={e => setQuoteForm({ ...quoteForm, itemRate: e.target.value })} placeholder="1850000" required />
            </div>

            <FormField label="GST Percentage (%)" name="gstPercentage" type="select" value={quoteForm.gstPercentage} onChange={e => setQuoteForm({ ...quoteForm, gstPercentage: e.target.value })}>
              <option value="18">18% Standard GST</option>
              <option value="12">12% Reduced GST</option>
              <option value="0">0% Exempted</option>
            </FormField>

            <FormField label="Terms & Notes" name="notes" type="textarea" value={quoteForm.notes} onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })} placeholder="50% advance, balance on final delivery." />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsQuotationModalOpen(false)} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                {submitting ? <><Loader2 className="animate-spin" size={14} /> Generating...</> : 'Generate Quotation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE INVOICE MODAL */}
      {isInvoiceModalOpen && (
        <Modal isOpen={isInvoiceModalOpen} title="Raise Milestone Invoice" onClose={resetInvoiceForm}>
          <form onSubmit={handleCreateInvoice}>
            <FormField label="Select Client" name="clientId" type="select" value={invoiceForm.clientId} onChange={e => setInvoiceForm({ ...invoiceForm, clientId: e.target.value })} required>
              <option value="">-- Choose Client --</option>
              {safeClients.map(c => (
                <option key={c._id} value={c._id}>{c.companyName || c.clientName}</option>
              ))}
            </FormField>

            <FormField label="Linked Project" name="projectId" type="select" value={invoiceForm.projectId} onChange={e => setInvoiceForm({ ...invoiceForm, projectId: e.target.value })}>
              <option value="">-- Select Project --</option>
              {safeProjects.map(p => (
                <option key={p._id} value={p._id}>{p.projectName}</option>
              ))}
            </FormField>

            <FormField label="Milestone Billing Name" name="milestoneName" value={invoiceForm.milestoneName} onChange={e => setInvoiceForm({ ...invoiceForm, milestoneName: e.target.value })} placeholder="e.g. 50% Advance Billing" required />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormField label="Subtotal (₹ Excl. GST)" name="subtotal" type="number" value={invoiceForm.subtotal} onChange={e => setInvoiceForm({ ...invoiceForm, subtotal: e.target.value })} placeholder="500000" required />
              <FormField label="Credit Period (Days)" name="dueDateDays" type="number" value={invoiceForm.dueDateDays} onChange={e => setInvoiceForm({ ...invoiceForm, dueDateDays: e.target.value })} placeholder="15" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsInvoiceModalOpen(false)} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                {submitting ? <><Loader2 className="animate-spin" size={14} /> Issuing...</> : 'Issue Invoice'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <Modal isOpen={isPaymentModalOpen} title="Record Client Payment Receipt" onClose={resetPaymentForm}>
          <form onSubmit={handleRecordPayment}>
            <FormField label="Target Pending Invoice" name="invoiceId" type="select" value={paymentForm.invoiceId} onChange={e => setPaymentForm({ ...paymentForm, invoiceId: e.target.value })} required>
              <option value="">-- Select Pending Invoice --</option>
              {(safeInvoices.filter(i => {
                const due = i.remainingBalance !== undefined ? i.remainingBalance : (i.dueBalance !== undefined ? i.dueBalance : Math.max(0, (i.totalAmount || i.amount || 0) - (i.paidAmount || (i.status === 'Paid' ? (i.totalAmount || 0) : 0))));
                return i.status !== 'Paid' || due > 0;
              }).length > 0
                ? safeInvoices.filter(i => {
                    const due = i.remainingBalance !== undefined ? i.remainingBalance : (i.dueBalance !== undefined ? i.dueBalance : Math.max(0, (i.totalAmount || i.amount || 0) - (i.paidAmount || (i.status === 'Paid' ? (i.totalAmount || 0) : 0))));
                    return i.status !== 'Paid' || due > 0;
                  })
                : safeInvoices
              ).map(inv => {
                const clientName = inv.client?.companyName || inv.client?.clientName || 'Client';
                const due = inv.remainingBalance !== undefined ? inv.remainingBalance : (inv.dueBalance !== undefined ? inv.dueBalance : Math.max(0, (inv.totalAmount || inv.amount || 0) - (inv.paidAmount || 0)));
                const tot = inv.totalAmount || inv.amount || 0;
                return (
                  <option key={inv._id} value={inv._id}>
                    {inv.invoiceNumber} — {clientName} (Total: ₹{tot.toLocaleString('en-IN')}{due > 0 ? `, Due: ₹${due.toLocaleString('en-IN')}` : ' [Paid]'})
                  </option>
                );
              })}
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormField label="Amount Paid (₹)" name="amountPaid" type="number" value={paymentForm.amountPaid} onChange={e => setPaymentForm({ ...paymentForm, amountPaid: e.target.value })} placeholder="200000" required />
              <FormField label="Payment Mode" name="paymentMode" type="select" value={paymentForm.paymentMode} onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}>
                <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
                <option value="UPI / Cheque">UPI / Cheque</option>
                <option value="Credit Card / Wire">Credit Card / Wire</option>
              </FormField>
            </div>

            <FormField label="Transaction Ref / UTR No." name="transactionReference" value={paymentForm.transactionReference} onChange={e => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })} placeholder="HDFC9823019830" />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                {submitting ? <><Loader2 className="animate-spin" size={14} /> Recording...</> : 'Record Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};



