/**
 * Timezone helpers — the shops are in Ontario, the servers are not.
 *
 * Vercel's runtime is UTC and every browser reports whatever the machine is
 * set to, so anything built on the ambient zone silently drifts. The concrete
 * failure: `new Date().toISOString().slice(0, 10)` returns *tomorrow's* date
 * from 8:00 PM EDT (7:00 PM EST) onward, because that is already midnight UTC.
 * Shops are still open then, so evening jobs were being stamped a day ahead.
 *
 * Two rules everywhere in the app:
 *   - "What day is it?"  → todayISO(), which is pinned to Ontario.
 *   - Displaying a value → date-only columns (`date` in Postgres) are calendar
 *     facts and must never be shifted; timestamps (`timestamptz`) must be shown
 *     in Ontario time.
 */

export const APP_TIME_ZONE = "America/Toronto";

/** Matches a bare Postgres `date` value as Supabase serialises it. */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isoDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The calendar date in Ontario at instant `d`, as YYYY-MM-DD.
 * Built from formatToParts rather than a formatted string so it can't be
 * broken by locale/ICU differences in separator or field order.
 */
export function toISODate(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const parts = isoDateParts.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's date in Ontario, as YYYY-MM-DD. Same answer on server and client. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** True when `value` is a bare YYYY-MM-DD date-only string. */
export function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}

/**
 * Parse a YYYY-MM-DD into a Date at **UTC midnight**.
 *
 * A date-only column carries no time and no zone, so it must be anchored to a
 * fixed point and then read back in that same zone. Anchoring to UTC (rather
 * than letting `new Date("2026-09-01")` land at UTC midnight and then be
 * *displayed* locally) is what stops an Ontario browser rendering "Aug 31".
 */
export function parseDateOnly(ymd: string): Date | null {
  const m = ISO_DATE_RE.exec(ymd);
  if (!m) return null;
  const [y, mo, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Add `n` days to a YYYY-MM-DD, staying calendar-exact (no DST drift). */
export function addDaysISO(ymd: string, n: number): string {
  const date = parseDateOnly(ymd);
  if (!date) return ymd;
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** `n` days from today in Ontario, as YYYY-MM-DD. */
export function daysFromTodayISO(n: number): string {
  return addDaysISO(todayISO(), n);
}
