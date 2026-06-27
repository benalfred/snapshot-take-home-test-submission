
export function parseDate(dateStr: string): Date {
  const iso = `${dateStr}T00:00:00.000Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return d;
}

export function calculateLeaveDays(
    startDate: Date,
    endDate: Date,
): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return (
      Math.floor(
          (endDate.getTime() - startDate.getTime()) /
          millisecondsPerDay,
      ) + 1
  );
}

/**
 * Return today's date as a UTC midnight Date (time stripped).
 */
export function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

