/**
 * Lightweight 5-field cron parser (no external deps).
 * Fields: minute hour day-of-month month day-of-week
 * Supports: *, numbers, comma lists (1,5,10), ranges (1-5), steps (* /5)
 */

function matchField(field: string, value: number, min: number, max: number): boolean {
  // Handle comma-separated values
  if (field.includes(",")) {
    return field.split(",").some((part) => matchField(part.trim(), value, min, max));
  }

  // Handle step values (*/5 or 1-10/2)
  if (field.includes("/")) {
    const [rangeStr, stepStr] = field.split("/");
    const step = parseInt(stepStr!, 10);
    if (isNaN(step) || step <= 0) return false;

    if (rangeStr === "*") {
      return (value - min) % step === 0;
    }
    // Range with step: 1-30/5
    if (rangeStr!.includes("-")) {
      const [startStr, endStr] = rangeStr!.split("-");
      const start = parseInt(startStr!, 10);
      const end = parseInt(endStr!, 10);
      if (isNaN(start) || isNaN(end)) return false;
      return value >= start && value <= end && (value - start) % step === 0;
    }
    return false;
  }

  // Handle range: 1-5
  if (field.includes("-")) {
    const [startStr, endStr] = field.split("-");
    const start = parseInt(startStr!, 10);
    const end = parseInt(endStr!, 10);
    if (isNaN(start) || isNaN(end)) return false;
    return value >= start && value <= end;
  }

  // Wildcard
  if (field === "*") return true;

  // Exact number
  const num = parseInt(field, 10);
  return !isNaN(num) && num === value;
}

/**
 * Check if a cron expression matches the given date.
 * @param expression 5-field cron: "minute hour day month weekday"
 * @param date Date to check against
 */
export function matchesCron(expression: string, date: Date): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields as [
    string,
    string,
    string,
    string,
    string,
  ];

  return (
    matchField(minute, date.getMinutes(), 0, 59) &&
    matchField(hour, date.getHours(), 0, 23) &&
    matchField(dayOfMonth, date.getDate(), 1, 31) &&
    matchField(month, date.getMonth() + 1, 1, 12) &&
    matchField(dayOfWeek, date.getDay(), 0, 6)
  );
}

/**
 * Compute the next run time for a cron expression, searching forward minute-by-minute
 * up to 366 days from `from`. Returns epoch ms or undefined if none found.
 */
export function nextCronRun(expression: string, from: Date): number | undefined {
  // Start from the next full minute
  const next = new Date(from.getTime());
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  const limit = from.getTime() + 366 * 24 * 60 * 60 * 1000;
  while (next.getTime() < limit) {
    if (matchesCron(expression, next)) {
      return next.getTime();
    }
    next.setMinutes(next.getMinutes() + 1);
  }
  return undefined;
}
