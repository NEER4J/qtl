// Item #15 — free grease offer eligibility check.
// Pure function (callable from client + server). Lives outside `lib/actions/*`
// because actions modules are `"use server"` and can only export async fns.

import { toISODate } from "./tz";

export function isFreeGreaseEligible(
  customer: { free_grease_until: string | null } | null | undefined,
  asOf: Date = new Date(),
): boolean {
  if (!customer?.free_grease_until) return false;
  // free_grease_until is YYYY-MM-DD and the whole day counts. Compared as
  // strings against Ontario's date: building a Date from the bare string
  // parsed it in the runtime's zone, so on the UTC server the offer expired
  // at 8 PM Ontario time on its own last day.
  return toISODate(asOf) <= customer.free_grease_until;
}
