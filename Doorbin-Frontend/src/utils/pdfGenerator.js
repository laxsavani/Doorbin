/**
 * Doorbin Visuals - Client-Side PDF & Print Document Generator
 */
export const downloadPdfDocument = ({ title, documentNumber, clientName, projectTitle, date, items, totalAmount, status }) => {
  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title} - ${documentNumber || 'Doorbin Visuals'}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1F1F1F; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #B68D40; padding-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #B68D40; letter-spacing: 2px; }
          .doc-type { font-size: 18px; text-transform: uppercase; color: #555; font-weight: 600; }
          .info-grid { display: flex; justify-content: space-between; margin: 30px 0; font-size: 14px; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #e0e0e0; padding: 12px; text-align: left; }
          th { background-color: #f7f6f2; color: #333; font-size: 12px; text-transform: uppercase; }
          .total-row { font-weight: bold; background-color: #faf7f2; }
          .footer { margin-top: 60px; font-size: 12px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">DOORBIN VISUALS</div>
          <div class="doc-type">${title}</div>
        </div>
        <div class="info-grid">
          <div>
            <strong>Document #:</strong> ${documentNumber || 'N/A'}<br/>
            <strong>Date:</strong> ${date || new Date().toLocaleDateString()}<br/>
            <strong>Status:</strong> ${status || 'Approved'}
          </div>
          <div>
            <strong>Client:</strong> ${clientName || 'Valued Client'}<br/>
            <strong>Project:</strong> ${projectTitle || 'Architectural Visualization'}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate (₹)</th>
              <th>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${(items && items.length > 0) ? items.map(item => `
              <tr>
                <td>${item.description || 'Architectural Render Service'}</td>
                <td>${item.qty || 1}</td>
                <td>₹${Number(item.rate || 0).toLocaleString('en-IN')}</td>
                <td>₹${Number((item.qty || 1) * (item.rate || 0)).toLocaleString('en-IN')}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="3">${title} Total Summary</td>
                <td>₹${Number(totalAmount || 0).toLocaleString('en-IN')}</td>
              </tr>
            `}
            <tr class="total-row">
              <td colspan="3" style="text-align: right;">Total Amount:</td>
              <td>₹${Number(totalAmount || 0).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
        <div class="footer">
          Doorbin Visuals · Collaborative Project Management System · Thank you for your business.
        </div>
      </body>
    </html>
  `;

  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}_${documentNumber || 'Doc'}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};
