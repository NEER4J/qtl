// Item #15 — free grease offer eligibility check.
// Pure functions (callable from client + server). Live outside `lib/actions/*`
// because actions modules are `"use server"` and can only export async fns.

import { addDaysISO, toISODate } from "./tz";

/** Days a vehicle's free-grease offer stays open after it is added. */
export const FREE_GREASE_DAYS = 30;

/** Last day (YYYY-MM-DD, Ontario) of a vehicle's free-grease offer. */
export function vehicleFreeGreaseUntil(vehicle: { created_at: string }): string {
  return addDaysISO(toISODate(new Date(vehicle.created_at)), FREE_GREASE_DAYS);
}

/**
 * The offer is per vehicle (client 2026-10-20): every vehicle — a new
 * customer's or an existing customer's new truck — gets free grease once in
 * its first 30 days. `usedVehicleIds` are vehicles that already redeemed it.
 * Dates compare as Ontario YYYY-MM-DD strings and the whole last day counts.
 */
export function isVehicleFreeGreaseEligible(
  vehicle: { id: string; created_at: string } | null | undefined,
  usedVehicleIds: ReadonlySet<string>,
  asOf: Date = new Date(),
): boolean {
  if (!vehicle || usedVehicleIds.has(vehicle.id)) return false;
  return toISODate(asOf) <= vehicleFreeGreaseUntil(vehicle);
}
