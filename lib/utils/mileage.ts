/**
 * Odometer readings → mileage (client 2026-10-20 — average job mileage).
 *
 * Readings are typed in at the counter and about one in ten is off: blank,
 * 0 or 1, a digit dropped or doubled, the truck's previous reading copied, or
 * a different truck's number. Averaging them as they are gives nonsense, so
 * per vehicle we count the LONGEST run of readings that only ever goes up, by
 * no more than MAX_KM_PER_DAY a day since the last counted one. Everything
 * else is left out of the averages (and shown as "not counted"). On live data
 * (Oct 2026) the median between visits is ~485 km a day, 95% of believable
 * intervals are under 1,000, and the rest jump to 5,000+ — typos.
 *
 * Longest run rather than "each reading must beat the one before": one typo
 * at the start (9,770,698 instead of 977,069) would otherwise knock out every
 * reading after it.
 */

/** More than a truck averages day after day, even with two drivers: a typo. */
export const MAX_KM_PER_DAY = 1500;

/** Readings below this are placeholders ("1", "10"), not an odometer. */
export const MIN_READING = 100;

export interface OdometerVisit {
  id: string;
  job_date: string;
  odometer: number | null;
  /** Tie-break for visits on the same day (created_at). */
  created_at?: string | null;
}

export interface CountedReading {
  /** This visit's reading is part of the vehicle's mileage. */
  counted: boolean;
  /** Why not: no reading at all, or one that doesn't fit the others. */
  skipped: "no_reading" | "out_of_line" | null;
  /** Km and days since the previous counted reading (null for the first). */
  km_since_prev: number | null;
  days_since_prev: number | null;
}

export interface MileageSummary {
  readings: number;
  first: { date: string; km: number } | null;
  last: { date: string; km: number } | null;
  /** Last counted reading − first; null with fewer than two readings. */
  km_covered: number | null;
  /** Days between the first and last counted readings. */
  days: number | null;
  avg_km_between: number | null;
  avg_km_per_day: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}

export function analyseOdometer<T extends OdometerVisit>(
  visits: readonly T[],
): { perVisit: Map<string, CountedReading>; summary: MileageSummary } {
  const perVisit = new Map<string, CountedReading>();
  const sorted = [...visits].sort(
    (a, b) =>
      a.job_date.localeCompare(b.job_date) ||
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      a.id.localeCompare(b.id),
  );
  const hasReading = (v: T) => v.odometer != null && v.odometer >= MIN_READING;
  const candidates = sorted.filter(hasReading);

  // Longest chain (DP over the chronological readings). Ties go to the later
  // reading, so the run ends as recently as possible.
  const best: number[] = [];
  const prev: number[] = [];
  for (let i = 0; i < candidates.length; i++) {
    best[i] = 1;
    prev[i] = -1;
    for (let j = 0; j < i; j++) {
      const km = candidates[i].odometer! - candidates[j].odometer!;
      if (km <= 0) continue;
      const days = daysBetween(candidates[j].job_date, candidates[i].job_date);
      if (km > MAX_KM_PER_DAY * Math.max(days, 1)) continue;
      if (best[j] + 1 >= best[i]) {
        best[i] = best[j] + 1;
        prev[i] = j;
      }
    }
  }
  let end = -1;
  for (let i = 0; i < candidates.length; i++) {
    if (end === -1 || best[i] >= best[end]) end = i;
  }
  const chain: T[] = [];
  for (let i = end; i !== -1; i = prev[i]) chain.unshift(candidates[i]);

  const inChain = new Set(chain.map((v) => v.id));
  for (const v of sorted) {
    perVisit.set(v.id, {
      counted: inChain.has(v.id),
      skipped: inChain.has(v.id) ? null : hasReading(v) ? "out_of_line" : "no_reading",
      km_since_prev: null,
      days_since_prev: null,
    });
  }
  for (let i = 1; i < chain.length; i++) {
    const r = perVisit.get(chain[i].id)!;
    r.km_since_prev = chain[i].odometer! - chain[i - 1].odometer!;
    r.days_since_prev = daysBetween(chain[i - 1].job_date, chain[i].job_date);
  }

  const first = chain[0];
  const last = chain[chain.length - 1];
  const kmCovered = chain.length >= 2 ? last.odometer! - first.odometer! : null;
  const days = chain.length >= 2 ? daysBetween(first.job_date, last.job_date) : null;
  return {
    perVisit,
    summary: {
      readings: chain.length,
      first: first ? { date: first.job_date, km: first.odometer! } : null,
      last: last ? { date: last.job_date, km: last.odometer! } : null,
      km_covered: kmCovered,
      days,
      avg_km_between: kmCovered != null ? kmCovered / (chain.length - 1) : null,
      avg_km_per_day: kmCovered != null && days != null && days > 0 ? kmCovered / days : null,
    },
  };
}

/** The rule in words, for the report page and the vehicle history page. */
export const MILEAGE_RULE =
  `Only believable readings count: per vehicle, the longest run of readings that keeps going up, ` +
  `by no more than ${MAX_KM_PER_DAY.toLocaleString("en-CA")} km a day. Blank readings (and anything under ` +
  `${MIN_READING} km), a reading lower than or the same as an earlier one, and impossible jumps — ` +
  `usually a typo — are left out.`;
