/**
 * Centralized Date Formatting & Parsing Utility for Doorbin Visuals System
 * Default Date Format: DD/MM/YYYY (e.g., 10/08/2026)
 */

/**
 * Format a Date object or valid date string into DD/MM/YYYY format.
 * @param {Date|string|number} dateInput
 * @returns {string|null} Formatted date string "DD/MM/YYYY" or null if invalid
 */
const formatDDMMYYYY = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
};

/**
 * Parse input string into a Date object.
 * Supports:
 *  - "DD/MM/YYYY" (e.g., "10/08/2026")
 *  - "YYYY-MM-DD" (e.g., "2026-08-10")
 *  - ISO Date strings
 * 
 * @param {string|Date} input
 * @param {boolean} isEnd - If true, sets time to 23:59:59.999
 * @returns {Date|null} Valid Date object or null
 */
const parseDateString = (input, isEnd = false) => {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  const str = String(input).trim();

  // Pattern 1: DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(str)) {
    const parts = str.split(/[\/\-]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    const d = isEnd ? new Date(year, month, day, 23, 59, 59, 999) : new Date(year, month, day, 0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  // Pattern 2: YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(str)) {
    const parts = str.split('T')[0].split(/[\/\-]/);
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const d = isEnd ? new Date(year, month, day, 23, 59, 59, 999) : new Date(year, month, day, 0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback to standard JS Date parsing
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Calculate working days (excluding Saturdays, Sundays, studio Holidays, and optional employee Approved Leaves) between two dates.
 */
const calculateWorkingDays = async (startDate, endDate, userId = null) => {
  const start = parseDateString(startDate);
  const end = parseDateString(endDate, true);

  if (!start || !end || start > end) return 0;

  const mongoose = require('mongoose');
  let holidayDatesSet = new Set();
  let leaveDatesSet = new Set();

  if (mongoose.models.Holiday) {
    const holidays = await mongoose.models.Holiday.find({
      date: { $gte: start, $lte: end }
    });
    holidays.forEach(h => {
      const dStr = formatDDMMYYYY(h.date);
      if (dStr) holidayDatesSet.add(dStr);
    });
  }

  if (userId && mongoose.models.Leave) {
    const leaves = await mongoose.models.Leave.find({
      employee: userId,
      status: 'Approved',
      fromDate: { $lte: end },
      toDate: { $gte: start }
    });

    leaves.forEach(l => {
      const curL = new Date(l.fromDate);
      const endL = new Date(l.toDate);
      while (curL <= endL) {
        const dStr = formatDDMMYYYY(curL);
        if (dStr) leaveDatesSet.add(dStr);
        curL.setDate(curL.getDate() + 1);
      }
    });
  }

  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const finish = new Date(end);
  finish.setHours(0, 0, 0, 0);

  while (cur <= finish) {
    const day = cur.getDay();
    const formattedDate = formatDDMMYYYY(cur);

    const isWeekend = (day === 0 || day === 6);
    const isHoliday = holidayDatesSet.has(formattedDate);
    const isOnLeave = leaveDatesSet.has(formattedDate);

    if (!isWeekend && !isHoliday && !isOnLeave) {
      count++;
    }

    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

/**
 * Calculate working days synchronously (excluding Saturdays & Sundays only).
 */
const calculateWorkingDaysSync = (startDate, endDate) => {
  const start = parseDateString(startDate);
  const end = parseDateString(endDate, true);

  if (!start || !end || start > end) return 0;

  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const finish = new Date(end);
  finish.setHours(0, 0, 0, 0);

  while (cur <= finish) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

/**
 * Get array of weekday date strings in DD/MM/YYYY format between start and end.
 */
const getWeekdayDatesDDMMYYYY = (startDate, endDate) => {
  const dates = [];
  const start = parseDateString(startDate);
  const end = parseDateString(endDate, true);

  if (!start || !end || start > end) return dates;

  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const finish = new Date(end);
  finish.setHours(0, 0, 0, 0);

  while (cur <= finish) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(formatDDMMYYYY(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

module.exports = {
  formatDDMMYYYY,
  parseDateString,
  calculateWorkingDays,
  calculateWorkingDaysSync,
  getWeekdayDatesDDMMYYYY
};
