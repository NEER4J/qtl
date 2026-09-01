import { APP_TIME_ZONE, isDateOnly, parseDateOnly, todayISO } from "./tz";

export { todayISO, APP_TIME_ZONE };

/**
 * Money formatter — CAD, no-break spaces, .99-friendly.
 */
const money = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return money.format(n);
}

// Unit costs can carry sub-cent precision (e.g. per-litre buying prices like
// 1.3712). Show at least 2 decimals, up to 6, trimming trailing zeros so a
// plain $1.37 still reads cleanly but 1.3712 isn't silently rounded.
const unitCost = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

export function formatUnitCost(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return unitCost.format(n);
}

// Date-only columns (Postgres `date`: job_date, expense_date, paid_on, …) are
// calendar facts with no zone. They are anchored at UTC midnight by
// parseDateOnly and read back in UTC, so the stored day is the day shown — in
// every browser, in every zone.
const dateOnlyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "2-digit",
});

// Timestamps (`timestamptz`: created_at, updated_at, …) are real instants and
// must be shown as the shop experienced them, not as UTC.
const timestampFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Format a date for display.
 *
 * Handles both shapes the app stores, because call sites legitimately pass
 * either: a bare `YYYY-MM-DD` is rendered as that exact calendar day, and
 * anything else is treated as an instant and rendered in Ontario time.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  if (isDateOnly(value)) {
    const d = parseDateOnly(value);
    return d ? dateOnlyFmt.format(d) : "—";
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return timestampFmt.format(d);
}

/** Clock time of an instant, in Ontario. */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return timeFmt.format(d);
}

/** Date + clock time of an instant, in Ontario. For audit trails and "last edited". */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return dateTimeFmt.format(d);
}

/**
 * Round a price UP to the next value ending in .99 (smallest k + 0.99 ≥ value,
 * k a non-negative integer). Values ≤ 0 are returned unchanged so $0 and credit
 * lines are never bumped. Used per-part for parts flagged `round_off`.
 */
export function roundUpTo99(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return value;
  const cents = Math.round(value * 100);
  const k = Math.max(0, Math.ceil((cents - 99) / 100));
  return k + 0.99;
}
