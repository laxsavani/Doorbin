import { jsPDF } from 'jspdf';

/**
 * Doorbin Visuals - Pure jsPDF Tax & GST Invoice/Quotation PDF Generator
 * Clean UI, proper Helvetica font support (using Rs. for currency), crisp alignment.
 */
export const downloadPdfDocument = ({
  title = 'OFFICIAL DOCUMENT',
  documentNumber = 'DOC-2026-001',
  clientName = 'Valued Client',
  clientGstin = '24ABCDE1234F1Z2',
  projectTitle = 'Architectural 3D Visualization',
  date = '',
  dueDate = '',
  items = [],
  subtotal = 0,
  gstAmount = 0,
  totalAmount = 0,
  status = 'Approved'
}) => {
  // 1. Calculate Financials & GST (18%: CGST 9% + SGST 9%)
  let finalSubtotal = Number(subtotal || 0);
  let finalTotal = Number(totalAmount || 0);

  if (!finalSubtotal) {
    if (Array.isArray(items) && items.length > 0) {
      finalSubtotal = items.reduce((acc, item) => acc + (Number(item.qty || 1) * Number(item.rate || 0)), 0);
    } else if (finalTotal > 0) {
      finalSubtotal = Math.round(finalTotal / 1.18);
    }
  }

  if (!finalTotal && finalSubtotal > 0) {
    finalTotal = Math.round(finalSubtotal * 1.18);
  }

  const cgst = Math.round(finalSubtotal * 0.09);
  const sgst = Math.round(finalSubtotal * 0.09);
  const calculatedGst = cgst + sgst;
  const grandTotal = finalSubtotal + calculatedGst;

  const docDate = date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const docDueDate = dueDate || new Date(Date.now() + 15 * 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // 2. Initialize jsPDF Document (A4 Portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [182, 141, 64]; // Doorbin Gold #B68D40
  const darkColor = [31, 31, 31];     // Doorbin Dark #1F1F1F
  const grayColor = [120, 116, 109];

  // Top Gold Accent Bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 6, 'F');

  // Company Brand Name & Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...darkColor);
  doc.text('DOORBIN VISUALS', 14, 20);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  doc.text('Architectural Visualization & Collaborative 3D Studio', 14, 26);

  // Document Title Header (Right Aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text(String(title).toUpperCase(), 196, 20, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkColor);
  doc.text('ORIGINAL TAX DOCUMENT', 196, 26, { align: 'right' });

  // Horizontal Separator Line
  doc.setDrawColor(230, 226, 218);
  doc.setLineWidth(0.5);
  doc.line(14, 30, 196, 30);

  // 3. Supplier & Recipient Addresses (Grid)
  // Left: Supplier Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...primaryColor);
  doc.text('ISSUED BY (SUPPLIER):', 14, 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkColor);
  doc.text('DOORBIN VISUALS PVT. LTD.', 14, 44);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text('402-405, NexAlliance Studio Towers, SG Highway', 14, 49);
  doc.text('Ahmedabad, Gujarat - 380054', 14, 53);
  doc.text('GSTIN: 24AAACD1234F1Z5 | State Code: 24 (Gujarat)', 14, 57);
  doc.text('Email: billing@doorbinvisuals.com | Mob: +91 98765 43210', 14, 61);

  // Right: Billed To (Client)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...primaryColor);
  doc.text('BILLED TO (RECIPIENT):', 114, 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkColor);
  doc.text(String(clientName || 'Valued Client').toUpperCase(), 114, 44);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`Project: ${projectTitle || '3D Visualization Service'}`, 114, 49);
  doc.text(`GSTIN: ${clientGstin || 'Unregistered'}`, 114, 53);

  // Document Number & Dates Box
  doc.setFillColor(250, 249, 246);
  doc.roundedRect(114, 56, 82, 18, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  doc.text(`Doc #: ${documentNumber}`, 117, 61);
  doc.text(`Date: ${docDate}`, 117, 66);
  doc.text(`Due Date: ${docDueDate}`, 117, 71);
  doc.text(`Status: ${status}`, 158, 61);

  // 4. Line Items Table (Pure jsPDF Custom Rendering)
  let y = 80;

  // Table Header Box
  doc.setFillColor(...darkColor);
  doc.rect(14, y, 182, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('#', 17, y + 5.5);
  doc.text('SERVICE / ITEM DESCRIPTION', 30, y + 5.5);
  doc.text('QTY', 125, y + 5.5, { align: 'center' });
  doc.text('RATE (Rs.)', 160, y + 5.5, { align: 'right' });
  doc.text('AMOUNT (Rs.)', 192, y + 5.5, { align: 'right' });

  y += 8;

  const displayItems = (Array.isArray(items) && items.length > 0) ? items : [
    { description: `${title} - ${projectTitle}`, qty: 1, rate: finalSubtotal }
  ];

  displayItems.forEach((item, idx) => {
    const qty = Number(item.qty || 1);
    const rate = Number(item.rate || 0);
    const amt = qty * rate;

    doc.setFillColor(idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 249, idx % 2 === 0 ? 255 : 246);
    doc.rect(14, y, 182, 8, 'F');
    doc.setDrawColor(230, 226, 218);
    doc.rect(14, y, 182, 8, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);

    doc.text(String(idx + 1), 17, y + 5.5);
    doc.text(String(item.description || item.itemDescription || projectTitle || 'Deliverable'), 30, y + 5.5);
    doc.text(String(qty), 125, y + 5.5, { align: 'center' });
    doc.text(`Rs. ${rate.toLocaleString('en-IN')}`, 160, y + 5.5, { align: 'right' });
    doc.text(`Rs. ${amt.toLocaleString('en-IN')}`, 192, y + 5.5, { align: 'right' });

    y += 8;
  });

  y += 6;

  // 5. Payment Details & GST Summary
  // Left Box: Bank Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('BANK TRANSFER / PAYMENT DETAILS:', 14, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Bank Name: HDFC Bank Ltd.', 14, y + 9);
  doc.text('Account Name: Doorbin Visuals Pvt Ltd', 14, y + 13);
  doc.text('Account No: 50200012345678', 14, y + 17);
  doc.text('IFSC Code: HDFC0001234 | Branch: SG Highway', 14, y + 21);

  // Right Box: GST Tax Calculation Breakdown
  const summaryX = 114;
  const summaryY = y;

  doc.setFillColor(250, 249, 246);
  doc.rect(summaryX, summaryY, 82, 38, 'F');
  doc.setDrawColor(230, 226, 218);
  doc.rect(summaryX, summaryY, 82, 38, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);

  doc.text('Subtotal (Excl. Tax):', summaryX + 4, summaryY + 7);
  doc.text(`Rs. ${finalSubtotal.toLocaleString('en-IN')}`, summaryX + 78, summaryY + 7, { align: 'right' });

  doc.text('CGST (Central Tax @ 9%):', summaryX + 4, summaryY + 13);
  doc.text(`Rs. ${cgst.toLocaleString('en-IN')}`, summaryX + 78, summaryY + 13, { align: 'right' });

  doc.text('SGST (State Tax @ 9%):', summaryX + 4, summaryY + 19);
  doc.text(`Rs. ${sgst.toLocaleString('en-IN')}`, summaryX + 78, summaryY + 19, { align: 'right' });

  doc.setDrawColor(210, 206, 198);
  doc.line(summaryX, summaryY + 23, summaryX + 82, summaryY + 23);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkColor);
  doc.text('GRAND TOTAL (INCL. GST):', summaryX + 4, summaryY + 31);
  doc.setTextColor(...primaryColor);
  doc.text(`Rs. ${grandTotal.toLocaleString('en-IN')}`, summaryX + 78, summaryY + 31, { align: 'right' });

  // 6. Terms & Signature Footer
  const footerY = summaryY + 44;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('TERMS & CONDITIONS:', 14, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('1. Payment is due within 15 days of document issuance.', 14, footerY + 5);
  doc.text('2. All renders & 3D visualization files subject to Doorbin Visuals licensing agreement.', 14, footerY + 9);
  doc.text('3. This is a computer-generated official tax document requiring no physical signature.', 14, footerY + 13);

  // Authorized Representative Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  doc.text('For DOORBIN VISUALS PVT. LTD.', 140, footerY);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...primaryColor);
  doc.text('[ Authorized Signatory Stamp ]', 140, footerY + 12);

  // Bottom Footer Dark Bar
  doc.setFillColor(...darkColor);
  doc.rect(0, 287, 210, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('DOORBIN VISUALS · COLLABORATIVE PROJECT MANAGEMENT SYSTEM', 105, 293, { align: 'center' });

  // 7. Save & Instant File Download
  const cleanDocNum = String(documentNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanTitle = String(title).replace(/\s+/g, '_');
  doc.save(`${cleanTitle}_${cleanDocNum}.pdf`);
};
