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
