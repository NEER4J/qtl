// Item #15 — free grease offer eligibility check.
// Pure function (callable from client + server). Lives outside `lib/actions/*`
// because actions modules are `"use server"` and can only export async fns.

export function isFreeGreaseEligible(
  customer: { free_grease_until: string | null } | null | undefined,
  asOf: Date = new Date(),
): boolean {
  if (!customer?.free_grease_until) return false;
  // free_grease_until is YYYY-MM-DD; treat the entire local day as eligible.
  const until = new Date(customer.free_grease_until + "T23:59:59");
  return asOf <= until;
}
