const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/**
 * Generate Excel workbook buffer from report data array
 */
const buildExcelBuffer = async (title, headers, rows) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Doorbin Visuals System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title.substring(0, 31));

  // Title Row
  sheet.addRow([title]);
  sheet.getRow(1).font = { size: 16, bold: true, color: { argb: 'FF1E293B' } };
  sheet.addRow([]);

  // Header Row
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }
  };

  // Data Rows
  rows.forEach(r => {
    sheet.addRow(r);
  });

  // Auto-fit Column Widths
  sheet.columns.forEach((col, idx) => {
    let maxLen = headers[idx] ? headers[idx].length : 12;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const valStr = cell.value ? cell.value.toString() : '';
      if (valStr.length > maxLen) maxLen = Math.min(valStr.length, 50);
    });
    col.width = maxLen + 4;
  });

  return await workbook.xlsx.writeBuffer();
};

/**
 * Stream Excel response directly to Express res
 */
const streamExcel = async (res, title, headers, rows, filename) => {
  const buffer = await buildExcelBuffer(title, headers, rows);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  return res.send(buffer);
};

/**
 * Generate PDF buffer from report data array
 */
const buildPdfBuffer = (title, headers, rows) => {
  return new Promise((resolve, reject) => {
    try {
      // Landscape A4 for wide table space
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const buffers = [];

      doc.on('data', b => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const pageWidth = doc.page.width; // ~841.89
      const pageHeight = doc.page.height; // ~595.28
      const margin = 30;
      const printableWidth = pageWidth - (margin * 2); // ~781.89

      // Header Banner
      doc.fillColor('#0F172A').fontSize(18).text('DOORBIN VISUALS', margin, 25, { align: 'center' });
      doc.fontSize(10).fillColor('#64748B').text('Collaborative Project Management System', { align: 'center' });
      doc.moveDown(0.4);
      doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
      doc.moveDown(0.8);

      // Report Title
      const titleY = doc.y;
      doc.fillColor('#1E293B').fontSize(14).text(title, margin, titleY, { align: 'left' });
      doc.fontSize(8).fillColor('#94A3B8').text(`Generated on: ${new Date().toLocaleString()}`, margin, titleY + 18, { align: 'left' });

      let startY = titleY + 36;
      const numCols = headers.length;

      // Smart Custom Column Width Proportions
      let colWidths = [];
      if (numCols === 9) {
        colWidths = [
          printableWidth * 0.15, // Name
          printableWidth * 0.23, // Email
          printableWidth * 0.10, // Role
          printableWidth * 0.08, // Present
          printableWidth * 0.08, // Absent
          printableWidth * 0.09, // Half Days
          printableWidth * 0.09, // On Leave
          printableWidth * 0.09, // Total Hours
          printableWidth * 0.09  // Avg Hours
        ];
      } else if (numCols === 7) {
        colWidths = [
          printableWidth * 0.12, // Date
          printableWidth * 0.14, // Status
          printableWidth * 0.13, // Clock In
          printableWidth * 0.13, // Clock Out
          printableWidth * 0.15, // Hours
          printableWidth * 0.11, // Late
          printableWidth * 0.22  // Remarks
        ];
      } else {
        const defaultW = printableWidth / numCols;
        colWidths = Array(numCols).fill(defaultW);
      }

      const getColX = (colIdx) => {
        let x = margin;
        for (let i = 0; i < colIdx; i++) {
          x += colWidths[i];
        }
        return x;
      };

      const headerHeight = 26;
      const rowHeight = 22;

      // Table Header Box
      doc.rect(margin, startY, printableWidth, headerHeight).fill('#0F172A');
      doc.fillColor('#FFFFFF').fontSize(8.5);

      headers.forEach((h, i) => {
        const x = getColX(i);
        const w = colWidths[i];
        doc.text(String(h), x + 4, startY + 8, {
          width: w - 8,
          height: 14,
          lineBreak: false,
          ellipsis: true
        });
      });

      startY += headerHeight;

      // Table Data Rows
      rows.forEach((r, rIdx) => {
        if (startY > pageHeight - 50) {
          doc.addPage();
          startY = 35;

          // Repeat Header Box on New Page
          doc.rect(margin, startY, printableWidth, headerHeight).fill('#0F172A');
          doc.fillColor('#FFFFFF').fontSize(8.5);
          headers.forEach((h, i) => {
            const x = getColX(i);
            const w = colWidths[i];
            doc.text(String(h), x + 4, startY + 8, {
              width: w - 8,
              height: 14,
              lineBreak: false,
              ellipsis: true
            });
          });
          startY += headerHeight;
        }

        // Alternating background fill
        if (rIdx % 2 === 1) {
          doc.rect(margin, startY, printableWidth, rowHeight).fill('#F8FAFC');
        }

        // Cell border line bottom
        doc.strokeColor('#F1F5F9').lineWidth(0.5).moveTo(margin, startY + rowHeight).lineTo(pageWidth - margin, startY + rowHeight).stroke();

        doc.fillColor('#334155').fontSize(8);
        r.forEach((cellVal, cIdx) => {
          const str = cellVal !== null && cellVal !== undefined ? String(cellVal) : '';
          const x = getColX(cIdx);
          const w = colWidths[cIdx];
          doc.text(str, x + 4, startY + 6, {
            width: w - 8,
            height: 12,
            lineBreak: false,
            ellipsis: true
          });
        });

        startY += rowHeight;
      });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * Stream PDF response directly to Express res
 */
const streamPdf = async (res, title, headers, rows, filename) => {
  const buffer = await buildPdfBuffer(title, headers, rows);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  return res.send(buffer);
};

/**
 * Stream CSV response directly to Express res
 */
const streamCsv = (res, title, headers, rows, filename) => {
  const csvLines = [];
  csvLines.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
  rows.forEach(row => {
    csvLines.push(row.map(cell => `"${String(cell !== null && cell !== undefined ? cell : '').replace(/"/g, '""')}"`).join(','));
  });
  const csvContent = csvLines.join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  return res.send(csvContent);
};

module.exports = {
  buildExcelBuffer,
  streamExcel,
  buildPdfBuffer,
  streamPdf,
  streamCsv
};
