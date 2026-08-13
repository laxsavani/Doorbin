/**
 * Centralized Date Formatting Utility
 * Formats any date input (ISO string, Date object, timestamp) into DD/MM/YYYY format
 */
export const formatDate = (dateInput) => {
  if (!dateInput) return '-';
  
  const strVal = String(dateInput).trim();
  if (strVal === 'Invalid Date') return '-';

  // If string is already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(strVal)) {
    return strVal;
  }

  // Handle DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(strVal)) {
    const [dd, mm, yyyy] = strVal.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return strVal !== 'Invalid Date' ? strVal : '-';

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
};

export const formatDateTime = (dateInput) => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

/**
 * Dynamic Live Artist Availability & Overlap Calculator
 * Calculates free days vs conflicting booked days for a given date range.
 */
export const checkArtistAvailabilityOverlap = (artistTasks = [], startDateStr, endDateStr) => {
  if (!startDateStr || !endDateStr) {
    return { isSelected: false, summaryText: '', availableDaysCount: 0, totalRequestedDays: 0, conflicts: [] };
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return { isSelected: false, summaryText: 'Invalid Date Range', availableDaysCount: 0, totalRequestedDays: 0, conflicts: [] };
  }

  const requestedDates = [];
  let curr = new Date(start.getTime());

  while (curr <= end) {
    requestedDates.push(new Date(curr.getTime()));
    curr.setDate(curr.getDate() + 1);
  }

  const totalRequestedDays = requestedDates.length;
  const freeDates = [];
  const conflictingDates = [];
  const conflictingTasksMap = {};

  requestedDates.forEach(dObj => {
    const dayTimestamp = dObj.getTime();
    let isBooked = false;
    let conflictName = '';

    (artistTasks || []).forEach(task => {
      const rawStart = task.rawStartDate || task.startDate;
      const rawEnd = task.rawEndDate || task.endDate;
      if (!rawStart || !rawEnd) return;

      const tStart = new Date(rawStart);
      const tEnd = new Date(rawEnd);
      tStart.setHours(0, 0, 0, 0);
      tEnd.setHours(23, 59, 59, 999);

      if (dayTimestamp >= tStart.getTime() && dayTimestamp <= tEnd.getTime()) {
        isBooked = true;
        conflictName = task.title ? `${task.project || 'Project'} (${task.title})` : (task.project || 'Existing Project');
      }
    });

    const dayStr = dObj.getDate() + ' ' + dObj.toLocaleString('en', { month: 'short' });
    if (isBooked) {
      conflictingDates.push(dayStr);
      if (conflictName) conflictingTasksMap[conflictName] = true;
    } else {
      freeDates.push(dayStr);
    }
  });

  const availableDaysCount = freeDates.length;
  const conflictTaskNames = Object.keys(conflictingTasksMap);

  let summaryText = '';
  if (availableDaysCount === totalRequestedDays) {
    summaryText = `✅ 100% Available (${availableDaysCount}/${totalRequestedDays} Days Free)`;
  } else if (availableDaysCount === 0) {
    summaryText = `⚠️ Fully Booked (0/${totalRequestedDays} Days Available). Conflicts: ${conflictTaskNames.join(', ')}`;
  } else {
    summaryText = `⚠️ ${availableDaysCount} Days Available (${freeDates.join(', ')}). Conflict on ${conflictingDates.join(', ')}`;
  }

  return {
    isSelected: true,
    availableDaysCount,
    totalRequestedDays,
    freeDates,
    conflictingDates,
    conflictTaskNames,
    summaryText,
    isFullyAvailable: availableDaysCount === totalRequestedDays,
    hasConflict: availableDaysCount < totalRequestedDays
  };
};
