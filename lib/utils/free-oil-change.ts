// Item #29 — 30-day free oil-change offer eligibility check.
// Mirrors lib/utils/free-grease.ts (item #15) so the two offers use the same
// shape. Pure function, callable from client + server.

export function isFreeOilChangeEligible(
  customer: { free_oil_change_until: string | null } | null | undefined,
  asOf: Date = new Date(),
): boolean {
  if (!customer?.free_oil_change_until) return false;
  const until = new Date(customer.free_oil_change_until + "T23:59:59");
  return asOf <= until;
}

/** ISO date string for `today + 30 days`, used by `grantFreeOilChange`. */
export function thirtyDaysFromTodayISO(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}
