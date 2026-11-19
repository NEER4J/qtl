import { ISO_DATE_RE, addDaysISO, parseDateOnly, todayISO } from "./tz";

/**
 * The longest span the Daily job report draws. It lists every job and payment
 * row by row (a month is ~2,300 jobs), so an unbounded range would build a page
 * nobody can scroll.
 */
export const MAX_DETAIL_DAYS = 92;

/** A real calendar day as YYYY-MM-DD (rejects 2026-02-30, 0002-01-01, ...). */
function validDay(value: string | null | undefined): value is string {
  return !!value && ISO_DATE_RE.test(value) && addDaysISO(value, 0) === value;
}

export interface DetailRange {
  from: string;
  to: string;
  /** The span asked for was longer than the limit, so `from` was pulled forward. */
  clamped: boolean;
}

/**
 * What a From/To pair on a detail report means. The boxes always show the
 * result, so what is on screen is what the report covers:
 *   - both       → that span (swapped if given backwards)
 *   - From only  → From up to today, as every other report treats a missing To
 *   - To only    → that one day
 *   - neither    → today
 *   - `date`     → the old single-day link, kept so saved links still work
 */
export function resolveDetailRange(
  input: { from?: string | null; to?: string | null; date?: string | null },
  maxDays = MAX_DETAIL_DAYS,
): DetailRange {
  const today = todayISO();
  const hasFrom = validDay(input.from);
  const hasTo = validDay(input.to);

  let from: string;
  let to: string;
  if (hasFrom && hasTo) {
    from = input.from as string;
    to = input.to as string;
  } else if (hasFrom) {
    from = input.from as string;
    to = from > today ? from : today;
  } else if (hasTo) {
    from = to = input.to as string;
  } else if (validDay(input.date)) {
    from = to = input.date;
  } else {
    from = to = today;
  }
  if (from > to) [from, to] = [to, from];

  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  const days = start && end ? Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1 : 1;
  if (days > maxDays) return { from: addDaysISO(to, -(maxDays - 1)), to, clamped: true };
  return { from, to, clamped: false };
}
