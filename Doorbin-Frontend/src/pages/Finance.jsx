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
import {
  FileText,
  DollarSign,
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
  Edit
} from 'lucide-react';
import './Dashboard.css';

export const Finance = () => {
  const [activeTab, setActiveTab] = useState('quotations'); // 'quotations' | 'invoices' | 'payments' | 'ageing'
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

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
  const [statusFilter, setStatusFilter] = useState('ALL');

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

    try {
      const selectedClient = clientsRoster.find(c => c._id === quoteForm.clientId);
      const newQuote = await financeService.createQuotation({
        client: selectedClient ? { _id: selectedClient._id, companyName: selectedClient.companyName, clientName: selectedClient.clientName } : { companyName: 'Client' },
        projectTitle: quoteForm.projectTitle,
        items: [
          { description: quoteForm.itemDesc || quoteForm.projectTitle, qty: 1, rate: Number(quoteForm.itemRate) }
        ],
        subtotal: Number(quoteForm.itemRate),
        gstPercentage: Number(quoteForm.gstPercentage),
        notes: quoteForm.notes
      });

      setQuotations(prev => [newQuote, ...prev]);
      setIsQuotationModalOpen(false);
      setToast({ message: `Quotation ${newQuote.quotationNumber} generated!`, type: 'success' });
      setQuoteForm({ clientId: '', projectTitle: '', validDays: 30, itemDesc: '', itemRate: '', gstPercentage: 18, notes: '' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to create quotation', type: 'error' });
    }
  };

  // Create Invoice Handler
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceForm.clientId || !invoiceForm.milestoneName || !invoiceForm.subtotal) {
      setToast({ message: 'Please fill in mandatory invoice details', type: 'error' });
      return;
    }

    try {
      const selectedClient = clientsRoster.find(c => c._id === invoiceForm.clientId);
      const selectedProject = projectsRoster.find(p => p._id === invoiceForm.projectId);

      const newInvoice = await financeService.createInvoice({
        client: selectedClient ? { _id: selectedClient._id, companyName: selectedClient.companyName, clientName: selectedClient.clientName } : { companyName: 'Client' },
        project: selectedProject ? { _id: selectedProject._id, projectName: selectedProject.projectName } : { projectName: 'General Project' },
        milestoneName: invoiceForm.milestoneName,
        subtotal: Number(invoiceForm.subtotal),
        gstPercentage: Number(invoiceForm.gstPercentage),
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 86400000 * Number(invoiceForm.dueDateDays)).toISOString()
      });

      setInvoices(prev => [newInvoice, ...prev]);
      setIsInvoiceModalOpen(false);
      setToast({ message: `Invoice ${newInvoice.invoiceNumber} created!`, type: 'success' });
      setInvoiceForm({ clientId: '', projectId: '', milestoneName: '', subtotal: '', gstPercentage: 18, dueDateDays: 15 });
    } catch (err) {
      setToast({ message: err.message || 'Failed to create invoice', type: 'error' });
    }
  };

  // Record Payment Handler
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.invoiceId || !paymentForm.amountPaid) {
      setToast({ message: 'Please select an invoice and enter amount', type: 'error' });
      return;
    }

    try {
      const targetInvoice = invoices.find(inv => inv._id === paymentForm.invoiceId);
      const newPayment = await financeService.recordPayment({
        invoice: { _id: targetInvoice._id, invoiceNumber: targetInvoice.invoiceNumber },
        client: targetInvoice.client,
        amountPaid: Number(paymentForm.amountPaid),
        paymentMode: paymentForm.paymentMode,
        transactionReference: paymentForm.transactionReference,
        remarks: paymentForm.remarks,
        paymentDate: new Date().toISOString()
      });

      // Update invoice payment status locally
      setInvoices(prev => prev.map(inv => {
        if (inv._id === paymentForm.invoiceId) {
          const newPaid = inv.paidAmount + Number(paymentForm.amountPaid);
          const newDue = Math.max(0, inv.totalAmount - newPaid);
          const newStatus = newDue === 0 ? 'Paid' : newPaid > 0 ? 'Partially Paid' : 'Pending';
          return { ...inv, paidAmount: newPaid, dueBalance: newDue, status: newStatus };
        }
        return inv;
      }));

      setPayments(prev => [newPayment, ...prev]);
      setIsPaymentModalOpen(false);
      setToast({ message: `Payment receipt ${newPayment.receiptNumber} recorded!`, type: 'success' });
      setPaymentForm({ invoiceId: '', amountPaid: '', paymentMode: 'Bank Transfer / NEFT', transactionReference: '', remarks: '' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to record payment', type: 'error' });
    }
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

  // Calculate metrics
  const totalInvoiced = safeInvoices.reduce((sum, i) => sum + (i?.totalAmount || 0), 0);
  const totalCollected = safeInvoices.reduce((sum, i) => sum + (i?.paidAmount || 0), 0);
  const totalOutstanding = safeInvoices.reduce((sum, i) => sum + (i?.dueBalance || 0), 0);

  return (
    <div className="main-content smooth-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', color: 'var(--color-secondary)', margin: 0 }}>
            Finance & Billing Management
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Quotations, milestone invoicing, GST calculation, payments & receivables ageing
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => setIsQuotationModalOpen(true)}>
            <Plus size={16} /> New Quotation
          </button>
          <button className="btn btn-secondary" onClick={() => setIsInvoiceModalOpen(true)}>
            <FileText size={16} /> Raise Invoice
          </button>
          <button className="btn btn-primary" onClick={() => setIsPaymentModalOpen(true)}>
            <CreditCard size={16} /> Record Payment
          </button>
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
              <DollarSign size={20} />
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

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--color-border)', marginBottom: '1.5rem' }}>
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
          Quotations ({safeQuotations.length})
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
          Invoices ({safeInvoices.length})
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
          Payment Receipts ({safePayments.length})
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
          Receivables Ageing Analysis
        </button>
      </div>

      {/* TAB CONTENT 1: QUOTATIONS */}
      {activeTab === 'quotations' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>QUOTATION #</th>
                <th>CLIENT NAME</th>
                <th>PROJECT TITLE</th>
                <th>SUBTOTAL</th>
                <th>GST (18%)</th>
                <th>TOTAL AMOUNT</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {safeQuotations.map(q => (
                <tr key={q._id}>
                  <td style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{q.quotationNumber}</td>
                  <td>{q.client?.companyName || q.client?.clientName}</td>
                  <td>{q.projectTitle}</td>
                  <td>₹{q.subtotal?.toLocaleString('en-IN')}</td>
                  <td>₹{q.gstAmount?.toLocaleString('en-IN')}</td>
                  <td style={{ fontWeight: '600' }}>₹{q.totalAmount?.toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`badge ${q.status === 'Approved' ? 'badge-success' : q.status === 'Sent' ? 'badge-warning' : 'badge-secondary'}`}>
                      {q.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => downloadPdfDocument({
                          title: 'OFFICIAL QUOTATION',
                          documentNumber: q.quotationNumber,
                          clientName: q.client?.companyName || q.client?.clientName,
                          projectTitle: q.projectTitle,
                          date: formatDate(q.quotationDate),
                          items: q.items,
                          totalAmount: q.totalAmount,
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT 2: INVOICES */}
      {activeTab === 'invoices' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>INVOICE #</th>
                <th>CLIENT</th>
                <th>MILESTONE</th>
                <th>DUE DATE</th>
                <th>TOTAL INVOICED</th>
                <th>PAID</th>
                <th>DUE BALANCE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {safeInvoices.map(inv => (
                <tr key={inv._id}>
                  <td style={{ fontWeight: '600', color: 'var(--color-secondary)' }}>{inv.invoiceNumber}</td>
                  <td>{inv.client?.companyName || inv.client?.clientName}</td>
                  <td>{inv.milestoneName}</td>
                  <td>{formatDate(inv.dueDate)}</td>
                  <td>₹{inv.totalAmount?.toLocaleString('en-IN')}</td>
                  <td style={{ color: 'var(--color-success)' }}>₹{inv.paidAmount?.toLocaleString('en-IN')}</td>
                  <td style={{ color: inv.dueBalance > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: '600' }}>
                    ₹{inv.dueBalance?.toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span className={`badge ${inv.status === 'Paid' ? 'badge-success' : inv.status === 'Partially Paid' ? 'badge-warning' : 'badge-danger'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => downloadPdfDocument({
                          title: 'TAX INVOICE',
                          documentNumber: inv.invoiceNumber,
                          clientName: inv.client?.companyName || inv.client?.clientName,
                          projectTitle: inv.milestoneName,
                          date: formatDate(inv.dueDate),
                          items: [{ description: inv.milestoneName, qty: 1, rate: inv.totalAmount }],
                          totalAmount: inv.totalAmount,
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT 3: PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>RECEIPT #</th>
                <th>INVOICE REF</th>
                <th>CLIENT</th>
                <th>PAYMENT DATE</th>
                <th>MODE</th>
                <th>REF NO.</th>
                <th>AMOUNT PAID</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {safePayments.map(p => (
                <tr key={p._id}>
                  <td style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{p.receiptNumber}</td>
                  <td>{p.invoice?.invoiceNumber}</td>
                  <td>{p.client?.companyName}</td>
                  <td>{formatDate(p.paymentDate)}</td>
                  <td>{p.paymentMode}</td>
                  <td>{p.transactionReference || 'N/A'}</td>
                  <td style={{ fontWeight: '700', color: 'var(--color-success)' }}>₹{p.amountPaid?.toLocaleString('en-IN')}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                      onClick={() => downloadPdfDocument({
                        title: 'PAYMENT RECEIPT',
                        documentNumber: p.receiptNumber,
                        clientName: p.client?.companyName,
                        projectTitle: `Payment for Invoice ${p.invoice?.invoiceNumber || ''}`,
                        date: formatDate(p.paymentDate),
                        items: [{ description: `Payment Mode: ${p.paymentMode} (Ref: ${p.transactionReference || 'N/A'})`, qty: 1, rate: p.amountPaid }],
                        totalAmount: p.amountPaid,
                        status: 'COMPLETED'
                      })}
                    >
                      <Download size={12} /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT 4: RECEIVABLES AGEING ANALYSIS */}
      {activeTab === 'ageing' && ageingData && ageingData.ageingBuckets && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          <div className="stat-card" style={{ borderTop: '4px solid var(--color-success)' }}>
            <div className="stat-card-title">0 - 30 DAYS (CURRENT)</div>
            <div className="stat-card-value">₹{((ageingData.ageingBuckets.current_0_30 || 0) / 100000).toFixed(2)} L</div>
            <div className="stat-card-subtext">Within standard payment credit period</div>
          </div>

          <div className="stat-card" style={{ borderTop: '4px solid var(--color-warning)' }}>
            <div className="stat-card-title">31 - 60 DAYS OVERDUE</div>
            <div className="stat-card-value" style={{ color: 'var(--color-warning)' }}>
              ₹{((ageingData.ageingBuckets.days_31_60 || 0) / 100000).toFixed(2)} L
            </div>
            <div className="stat-card-subtext">First reminder notification sent</div>
          </div>

          <div className="stat-card" style={{ borderTop: '4px solid #f97316' }}>
            <div className="stat-card-title">61 - 90 DAYS OVERDUE</div>
            <div className="stat-card-value" style={{ color: '#f97316' }}>
              ₹{((ageingData.ageingBuckets.days_61_90 || 0) / 100000).toFixed(2)} L
            </div>
            <div className="stat-card-subtext">Escalation required</div>
          </div>

          <div className="stat-card" style={{ borderTop: '4px solid var(--color-danger)' }}>
            <div className="stat-card-title">90+ DAYS OVERDUE</div>
            <div className="stat-card-value" style={{ color: 'var(--color-danger)' }}>
              ₹{((ageingData.ageingBuckets.days_90_plus || 0) / 100000).toFixed(2)} L
            </div>
            <div className="stat-card-subtext">High risk receivables</div>
          </div>
        </div>
      )}

      {/* CREATE QUOTATION MODAL */}
      {isQuotationModalOpen && (
        <Modal isOpen={isQuotationModalOpen} title="Create Client Quotation" onClose={() => setIsQuotationModalOpen(false)}>
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
              <button type="button" className="btn btn-secondary" onClick={() => setIsQuotationModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Generate Quotation</button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE INVOICE MODAL */}
      {isInvoiceModalOpen && (
        <Modal isOpen={isInvoiceModalOpen} title="Raise Milestone Invoice" onClose={() => setIsInvoiceModalOpen(false)}>
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
              <button type="button" className="btn btn-secondary" onClick={() => setIsInvoiceModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Issue Invoice</button>
            </div>
          </form>
        </Modal>
      )}

      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <Modal isOpen={isPaymentModalOpen} title="Record Client Payment Receipt" onClose={() => setIsPaymentModalOpen(false)}>
          <form onSubmit={handleRecordPayment}>
            <FormField label="Target Pending Invoice" name="invoiceId" type="select" value={paymentForm.invoiceId} onChange={e => setPaymentForm({ ...paymentForm, invoiceId: e.target.value })} required>
              <option value="">-- Select Pending Invoice --</option>
              {safeInvoices.filter(i => i.dueBalance > 0).map(inv => (
                <option key={inv._id} value={inv._id}>
                  {inv.invoiceNumber} - {inv.client?.companyName} (Due: ₹{inv.dueBalance?.toLocaleString('en-IN')})
                </option>
              ))}
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
              <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Record Payment</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
