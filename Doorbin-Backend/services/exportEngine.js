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
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', b => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Header Banner
      doc.fillColor('#0F172A').fontSize(20).text('DOORBIN VISUALS', { align: 'center' });
      doc.fontSize(12).fillColor('#64748B').text('Collaborative Project Management System', { align: 'center' });
      doc.moveDown(0.5);
      doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(1);

      // Report Title
      doc.fillColor('#1E293B').fontSize(16).text(title, { align: 'left' });
      doc.fontSize(9).fillColor('#94A3B8').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'left' });
      doc.moveDown(1);

      // Table Rendering
      const startX = 40;
      let startY = doc.y;
      const colWidth = Math.floor((515) / Math.max(headers.length, 1));

      // Table Header Row
      doc.rect(startX, startY, 515, 20).fill('#0F172A');
      doc.fillColor('#FFFFFF').fontSize(10);
      headers.forEach((h, i) => {
        doc.text(String(h), startX + i * colWidth + 4, startY + 5, { width: colWidth - 8, truncate: true });
      });

      startY += 22;

      // Table Data Rows
      doc.fillColor('#334155').fontSize(9);
      rows.forEach((r, rIdx) => {
        if (startY > 720) {
          doc.addPage();
          startY = 40;
        }

        if (rIdx % 2 === 1) {
          doc.rect(startX, startY, 515, 18).fill('#F8FAFC');
        }

        doc.fillColor('#334155');
        r.forEach((cellVal, cIdx) => {
          const str = cellVal !== null && cellVal !== undefined ? String(cellVal) : '';
          doc.text(str, startX + cIdx * colWidth + 4, startY + 4, { width: colWidth - 8, truncate: true });
        });
        startY += 18;
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

module.exports = {
  buildExcelBuffer,
  streamExcel,
  buildPdfBuffer,
  streamPdf
};
