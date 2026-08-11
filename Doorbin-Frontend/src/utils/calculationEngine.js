/**
 * Doorbin Visuals - Auto Calculation Engine
 * Page 19 Requirements: Working Days, Progress Cascade, Delay Calculation & Revenue Realization
 */

/**
 * Calculates net working days between two dates excluding weekends (Saturdays & Sundays) and studio holidays
 * @param {Date|string} startDate 
 * @param {Date|string} endDate 
 * @param {Array} holidays - Array of holiday date strings ['YYYY-MM-DD', ...]
 * @returns {number} Net working days
 */
export const calculateWorkingDays = (startDate, endDate, holidays = []) => {
  if (!startDate || !endDate) return 0;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;
  
  const holidaySet = new Set(holidays.map(h => new Date(h.date || h).toISOString().split('T')[0]));
  let count = 0;
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];
    
    // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(dateStr);
    
    if (!isWeekend && !isHoliday) {
      count++;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

/**
 * Calculates delay in days based on due date
 * @param {Date|string} endDate - Target due date
 * @param {string} status - Current task/project status
 * @returns {number} Delay in days (0 if on track or completed)
 */
export const calculateDelayDays = (endDate, status) => {
  if (!endDate || status === 'Completed' || status === 'Approved' || status === 'Won') return 0;
  
  const target = new Date(endDate);
  const today = new Date();
  
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  if (today > target) {
    const diffTime = Math.abs(today - target);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  return 0;
};

/**
 * Calculates overall completion percentage across stages
 * @param {Array} stages - Array of project stages with subStages
 * @returns {number} Overall progress percentage (0 - 100)
 */
export const calculateOverallProgress = (stages = []) => {
  if (!Array.isArray(stages) || stages.length === 0) return 0;
  
  let totalSubStages = 0;
  let completedSubStages = 0;
  
  stages.forEach(stage => {
    const subStages = stage.subStages || [];
    subStages.forEach(sub => {
      totalSubStages++;
      if (sub.status === 'Approved' || sub.status === 'Completed' || sub.completionPercentage === 100) {
        completedSubStages++;
      } else if (sub.completionPercentage) {
        completedSubStages += (sub.completionPercentage / 100);
      }
    });
  });
  
  if (totalSubStages === 0) return 0;
  return Math.round((completedSubStages / totalSubStages) * 100);
};

/**
 * Calculates revenue realization percentage
 * @param {number} totalBilled 
 * @param {number} totalCollected 
 * @returns {number} Realization percentage
 */
export const calculateRevenueRealization = (totalBilled, totalCollected) => {
  const billed = Number(totalBilled || 0);
  const collected = Number(totalCollected || 0);
  if (billed <= 0) return 0;
  return Math.min(100, Math.round((collected / billed) * 100));
};
