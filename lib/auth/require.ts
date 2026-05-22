import "server-only";

import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/get-profile";
import type { Profile, UserRole } from "@/lib/db/types";

export class AuthorizationError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Require the user to be signed in. Redirects to /auth/login otherwise.
 */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.active) redirect("/auth/login?error=account_disabled");
  return profile;
}

/**
 * Require the user to hold one of the given roles.
 * Throws AuthorizationError (caller can map to 403) if mismatched.
 */
export async function requireRole(...roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    throw new AuthorizationError(
      `Role ${profile.role} is not permitted (requires ${roles.join(", ")})`,
    );
  }
  return profile;
}

/**
 * Require that the caller is entitled to act on the given location.
 * Owner + accountant pass for any location. Manager/staff must match their
 * assigned location. Employees fail.
 */
export async function requireLocation(locationId: string): Promise<Profile> {
  const profile = await requireProfile();

  if (profile.role === "owner" || profile.role === "accountant") {
    return profile;
  }

  // Cross-location managers/staff/employees act as if they had this location.
  if (profile.cross_location && profile.role !== "portal_customer") {
    return profile;
  }

  if (profile.role === "employee") {
    throw new AuthorizationError("Employees cannot access location data");
  }

  if (profile.location_id !== locationId) {
    throw new AuthorizationError("Location mismatch");
  }

  return profile;
}

export function isOwner(profile: Profile | null): boolean {
  return profile?.role === "owner";
}

export function isAccountant(profile: Profile | null): boolean {
  return profile?.role === "accountant";
}

export function isManager(profile: Profile | null): boolean {
  return profile?.role === "manager";
}

export function isStaff(profile: Profile | null): boolean {
  return profile?.role === "staff";
}

export function isEmployee(profile: Profile | null): boolean {
  return profile?.role === "employee";
}

/**
 * Owner or accountant — the two cross-location admin roles.
 */
export function isCrossLocation(profile: Profile | null): boolean {
  return profile?.role === "owner" || profile?.role === "accountant";
}
