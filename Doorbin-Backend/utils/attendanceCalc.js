const SHIFT_START = process.env.DEFAULT_SHIFT_START || '09:00';
const SHIFT_END = process.env.DEFAULT_SHIFT_END || '18:00';

/**
 * Calculates total worked duration in hours (rounded to 2 decimal places)
 */
function calculateWorkingHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return 0;
  const diffMs = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  if (diffMs <= 0) return 0;
  const hours = diffMs / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100;
}

/**
 * Checks if clockIn time is later than shift start time
 */
function checkLateArrival(clockIn, shiftStart = SHIFT_START) {
  if (!clockIn) return false;
  const inDate = new Date(clockIn);
  const [sh, sm] = shiftStart.split(':').map(Number);
  const shiftStartTimeMs = new Date(inDate).setHours(sh, sm, 0, 0);
  return inDate.getTime() > shiftStartTimeMs;
}

/**
 * Checks if clockOut time is earlier than shift end time
 */
function checkEarlyLeave(clockOut, shiftEnd = SHIFT_END) {
  if (!clockOut) return false;
  const outDate = new Date(clockOut);
  const [eh, em] = shiftEnd.split(':').map(Number);
  const shiftEndTimeMs = new Date(outDate).setHours(eh, em, 0, 0);
  return outDate.getTime() < shiftEndTimeMs;
}

module.exports = {
  SHIFT_START,
  SHIFT_END,
  calculateWorkingHours,
  checkLateArrival,
  checkEarlyLeave
};
