import { downloadPdfDocument } from './pdfGenerator';
import { formatDate } from './dateUtils';

/**
 * Utility to export Quotations, Invoices, Payments, and Receivables Ageing to Excel (.csv) and PDF
 */
export const exportFinanceTabData = (activeTab, format, { quotations = [], invoices = [], payments = [], ageingData = null }) => {
  const timestamp = new Date().toISOString().split('T')[0];

  if (activeTab === 'quotations') {
    if (format === 'excel' || format === 'csv') {
      const headers = ['Sr. No.', 'Quotation Number', 'Client Name', 'Project Title', 'Quotation Date', 'Valid Until', 'Subtotal (₹)', 'GST Amount (₹)', 'Total Amount (₹)', 'Status'];
      const rows = quotations.map((q, idx) => [
        idx + 1,
        `"${q.quotationNumber || ''}"`,
        `"${q.client?.companyName || q.client?.clientName || 'N/A'}"`,
        `"${q.projectTitle || ''}"`,
        `"${formatDate(q.quotationDate || q.createdAt)}"`,
        `"${formatDate(q.validUntil)}"`,
        q.subtotal || 0,
        q.gstAmount || 0,
        q.totalAmount || 0,
        `"${q.status || 'Draft'}"`
      ]);

      downloadCsvFile(`Quotations_Export_${timestamp}.csv`, headers, rows);
    } else {
      // PDF Export
      const items = quotations.map((q) => ({
        description: `Quot #${q.quotationNumber} - ${q.client?.companyName || q.client?.clientName} (${q.projectTitle})`,
        qty: 1,
        rate: q.totalAmount || 0
      }));

      downloadPdfDocument({
        title: 'OFFICIAL QUOTATIONS REGISTER REPORT',
        documentNumber: `REP-QUOT-${Date.now().toString().slice(-6)}`,
        clientName: 'Doorbin Visuals Finance',
        projectTitle: `Active & Approved Quotations Register (${quotations.length} Total)`,
        date: new Date().toLocaleDateString(),
        items: items.length > 0 ? items : [{ description: 'No quotations found', qty: 1, rate: 0 }],
        totalAmount: quotations.reduce((sum, q) => sum + (q.totalAmount || 0), 0),
        status: 'Generated'
      });
    }
    return;
  }

  if (activeTab === 'invoices') {
    if (format === 'excel' || format === 'csv') {
      const headers = ['Sr. No.', 'Invoice Number', 'Quotation Ref', 'Client Name', 'Project Title', 'Issue Date', 'Due Date', 'Total Amount (₹)', 'Amount Received (₹)', 'Balance Due (₹)', 'Status'];
      const rows = invoices.map((inv, idx) => [
        idx + 1,
        `"${inv.invoiceNumber || ''}"`,
        `"${inv.quotationNumber || 'N/A'}"`,
        `"${inv.client?.companyName || inv.client?.clientName || 'N/A'}"`,
        `"${inv.project?.projectName || inv.projectTitle || 'N/A'}"`,
        `"${formatDate(inv.issueDate || inv.createdAt)}"`,
        `"${formatDate(inv.dueDate)}"`,
        inv.totalAmount || 0,
        inv.amountReceived || 0,
        Math.max(0, (inv.totalAmount || 0) - (inv.amountReceived || 0)),
        `"${inv.status || 'Pending'}"`
      ]);

      downloadCsvFile(`Invoices_Export_${timestamp}.csv`, headers, rows);
    } else {
      // PDF Export
      const items = invoices.map((inv) => ({
        description: `Inv #${inv.invoiceNumber} - ${inv.client?.companyName || inv.client?.clientName} (${inv.project?.projectName || 'Project'}) [Due: ₹${(Math.max(0, (inv.totalAmount || 0) - (inv.amountReceived || 0))).toLocaleString('en-IN')}]`,
        qty: 1,
        rate: inv.totalAmount || 0
      }));

      downloadPdfDocument({
        title: 'OFFICIAL INVOICES REGISTER REPORT',
        documentNumber: `REP-INV-${Date.now().toString().slice(-6)}`,
        clientName: 'Doorbin Visuals Finance',
        projectTitle: `Invoices & Billing Summary (${invoices.length} Invoices)`,
        date: new Date().toLocaleDateString(),
        items: items.length > 0 ? items : [{ description: 'No invoices found', qty: 1, rate: 0 }],
        totalAmount: invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0),
        status: 'Generated'
      });
    }
    return;
  }

  if (activeTab === 'payments') {
    if (format === 'excel' || format === 'csv') {
      const headers = ['Sr. No.', 'Receipt Number', 'Invoice Ref', 'Client Name', 'Payment Date', 'Payment Mode', 'Reference / UTR No.', 'Amount Paid (₹)'];
      const rows = payments.map((pmt, idx) => [
        idx + 1,
        `"${pmt.receiptNumber || ''}"`,
        `"${pmt.invoice?.invoiceNumber || pmt.invoiceRef || 'N/A'}"`,
        `"${pmt.client?.companyName || pmt.client?.clientName || 'N/A'}"`,
        `"${formatDate(pmt.paymentDate || pmt.createdAt)}"`,
        `"${pmt.paymentMode || 'Bank Transfer'}"`,
        `"${pmt.referenceNumber || 'N/A'}"`,
        pmt.amountPaid || 0
      ]);

      downloadCsvFile(`Payments_Export_${timestamp}.csv`, headers, rows);
    } else {
      // PDF Export
      const items = payments.map((p) => ({
        description: `Receipt #${p.receiptNumber} - Inv: ${p.invoice?.invoiceNumber || 'N/A'} - ${p.client?.companyName || p.client?.clientName} (${p.paymentMode || 'Bank Transfer'} - Ref: ${p.referenceNumber || 'N/A'})`,
        qty: 1,
        rate: p.amountPaid || 0
      }));

      downloadPdfDocument({
        title: 'OFFICIAL PAYMENTS & RECEIPTS REGISTER REPORT',
        documentNumber: `REP-PMT-${Date.now().toString().slice(-6)}`,
        clientName: 'Doorbin Visuals Finance',
        projectTitle: `Payments & Realized Collections Log (${payments.length} Payments)`,
        date: new Date().toLocaleDateString(),
        items: items.length > 0 ? items : [{ description: 'No payment records found', qty: 1, rate: 0 }],
        totalAmount: payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0),
        status: 'Generated'
      });
    }
    return;
  }

  if (activeTab === 'ageing') {
    const list = ageingData?.clientsList || ageingData?.ageingList || [];
    if (format === 'excel' || format === 'csv') {
      const headers = ['Sr. No.', 'Client Name', '0-30 Days (Current) (₹)', '31-60 Days (₹)', '61-90 Days (₹)', '90+ Days (Overdue) (₹)', 'Total Outstanding (₹)'];
      const rows = list.map((c, idx) => [
        idx + 1,
        `"${c.clientName || 'N/A'}"`,
        c.current_0_30 || 0,
        c.days_31_60 || 0,
        c.days_61_90 || 0,
        c.days_90_plus || 0,
        c.totalOutstanding || 0
      ]);

      downloadCsvFile(`Receivables_Ageing_Export_${timestamp}.csv`, headers, rows);
    } else {
      const items = list.map((c) => ({
        description: `Client: ${c.clientName || 'N/A'} - Overdue (90+ Days): ₹${(c.days_90_plus || 0).toLocaleString('en-IN')}`,
        qty: 1,
        rate: c.totalOutstanding || 0
      }));

      downloadPdfDocument({
        title: 'RECEIVABLES AGEING ANALYSIS REPORT',
        documentNumber: `REP-AGE-${Date.now().toString().slice(-6)}`,
        clientName: 'Doorbin Visuals Finance',
        projectTitle: `Client Outstanding Ageing Breakdown (${list.length} Clients)`,
        date: new Date().toLocaleDateString(),
        items: items.length > 0 ? items : [{ description: 'No outstanding ageing records found', qty: 1, rate: 0 }],
        totalAmount: list.reduce((sum, c) => sum + (c.totalOutstanding || 0), 0),
        status: 'Generated'
      });
    }
  }
};

const downloadCsvFile = (filename, headers, rows) => {
  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
    + headers.join(',') + '\n'
    + rows.map(e => e.join(',')).join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
};
