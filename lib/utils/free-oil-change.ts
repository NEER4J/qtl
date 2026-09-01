// Item #29 — 30-day free oil-change offer eligibility check.
// Mirrors lib/utils/free-grease.ts (item #15) so the two offers use the same
// shape. Pure function, callable from client + server.

import { addDaysISO, toISODate } from "./tz";

export function isFreeOilChangeEligible(
  customer: { free_oil_change_until: string | null } | null | undefined,
  asOf: Date = new Date(),
): boolean {
  if (!customer?.free_oil_change_until) return false;
  // See isFreeGreaseEligible — string compare against Ontario's date.
  return toISODate(asOf) <= customer.free_oil_change_until;
}

/** ISO date string for `today + 30 days`, used by `grantFreeOilChange`. */
export function thirtyDaysFromTodayISO(now: Date = new Date()): string {
  return addDaysISO(toISODate(now), 30);
}
