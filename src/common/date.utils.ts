/**
 * Date utilities.
 *
 * Assumptions documented in README:
 * - All dates are stored and compared as calendar dates in UTC.
 * - "days requested" counts ALL calendar days inclusive (weekends included).
 * - No public-holiday awareness in this implementation (documented limitation).
 */

/**
 * Parse a YYYY-MM-DD string into a UTC midnight Date.
 * Throws if the string is not a valid date.
 */
export function parseDate(dateStr: string): Date {
  const iso = `${dateStr}T00:00:00.000Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return d;
}

/**
 * Return today's date as a UTC midnight Date (time stripped).
 */
export function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Compute the inclusive number of calendar days between two dates.
 * e.g. 2024-03-01 to 2024-03-03 = 3 days
 */
export function calcDays(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Returns true if the leave period is entirely in the past.
 * "Today" can still be submitted — the rule is "entirely in the past".
 */
export function isEntirelyInPast(startDate: string, endDate: string): boolean {
  const today = todayUTC();
  const end = parseDate(endDate);
  return end < today;
}

/**
 * Returns true if startDate is after endDate.
 */
export function isInvalidRange(startDate: string, endDate: string): boolean {
  return parseDate(startDate) > parseDate(endDate);
}
