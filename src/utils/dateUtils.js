/**
 * Supported exact lead-time windows for the SIH prototype.
 */
export const SUPPORTED_LEAD_TIME_DAYS = Object.freeze([1, 7, 15, 30, 45]);

export const LEAD_TIME_BUCKETS = Object.freeze({
  1: 'T+1',
  7: 'T+7',
  15: 'T+15',
  30: 'T+30',
  45: 'T+45',
});

/**
 * Extracts a canonical calendar date string (YYYY-MM-DD) from a Date object or ISO string,
 * avoiding accidental timezone-induced day shifts.
 * 
 * @param {string|Date} input 
 * @returns {string|null} YYYY-MM-DD or null
 */
export function getCalendarDateString(input) {
  if (!input) return null;

  if (input instanceof Date && !isNaN(input.getTime())) {
    return input.toISOString().split('T')[0];
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    // Check if starts with YYYY-MM-DD
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      // Validate calendar date
      const testDate = new Date(Date.UTC(year, month - 1, day));
      if (
        testDate.getUTCFullYear() === year &&
        testDate.getUTCMonth() === month - 1 &&
        testDate.getUTCDate() === day
      ) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
    }
  }

  return null;
}

/**
 * Calculates exact calendar-day lead time between departure date and collection (scraped) date.
 * Uses UTC midnight boundaries to guarantee zero timezone or daylight saving skew.
 * 
 * @param {string|Date} departureDate 
 * @param {string|Date} collectionDate 
 * @returns {number|null} Integer difference in calendar days, or null if invalid
 */
export function calculateLeadTimeDays(departureDate, collectionDate) {
  const depStr = getCalendarDateString(departureDate);
  const colStr = getCalendarDateString(collectionDate);

  if (!depStr || !colStr) return null;

  const [depYear, depMonth, depDay] = depStr.split('-').map((v) => parseInt(v, 10));
  const [colYear, colMonth, colDay] = colStr.split('-').map((v) => parseInt(v, 10));

  const depUtc = Date.UTC(depYear, depMonth - 1, depDay);
  const colUtc = Date.UTC(colYear, colMonth - 1, colDay);

  const diffMs = depUtc - colUtc;
  const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return daysDiff;
}

/**
 * Maps an exact lead-time days value to its corresponding bucket string ('T+1', 'T+7', etc.).
 * Strictly disallows fuzzy or nearby matches (e.g. 6 is NOT T+7, 8 is NOT T+7).
 * 
 * @param {number} leadTimeDays 
 * @returns {'T+1'|'T+7'|'T+15'|'T+30'|'T+45'|null}
 */
export function getLeadTimeBucket(leadTimeDays) {
  if (typeof leadTimeDays !== 'number' || !Number.isInteger(leadTimeDays)) {
    return null;
  }
  return LEAD_TIME_BUCKETS[leadTimeDays] || null;
}
