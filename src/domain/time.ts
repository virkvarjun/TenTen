/**
 * Pure time helpers. Domain logic never reads the wall clock (no `Date.now()`);
 * callers pass in an explicit reference day and these helpers derive spans from
 * it. Constructing a Date from explicit fields is deterministic and allowed.
 */

/** Midnight (local) of the day containing `date`. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** A Date at the given fractional hour on `day` (e.g. 9.5 -> 09:30). */
export function atHour(day: Date, hour: number): Date {
  const base = startOfDay(day);
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  base.setHours(whole, minutes, 0, 0);
  return base;
}

/** Fractional hour-of-day for a Date (e.g. 09:30 -> 9.5). */
export function hourOf(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

/** Whole + fractional hours between two Dates. */
export function durationHours(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

/** Minutes between two Dates. */
export function durationMinutes(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60);
}

/** True if [aStart, aEnd) overlaps [bStart, bEnd). */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
