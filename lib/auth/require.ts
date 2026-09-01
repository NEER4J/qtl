import "server-only";

import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/get-profile";
import {
  effectiveAllowedPageKeys,
  isAnyPageAllowed,
  isPageAllowed,
} from "@/lib/permissions/check";
import { PAGE_REGISTRY } from "@/lib/permissions/registry";
import { canAccessLocation } from "@/lib/auth/locations";
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
 * Where to send someone who just hit a page they aren't allowed to open.
 * Mirrors the (app) layout: /dashboard when they have it, otherwise the first
 * page in registry order that they do.
 */
function fallbackPathFor(profile: Profile): string {
  const allowed = effectiveAllowedPageKeys(profile);
  if (allowed.has("dashboard")) return "/dashboard";
  const first = PAGE_REGISTRY.find((p) => allowed.has(p.key));
  return first?.path ?? "/auth/login?error=no_access";
}

/**
 * Require that the caller can open the given registry page.
 *
 * This is the guard every gated page should use. Hard-coded `requireRole(...)`
 * lists on a page are a SECOND, independent gate that the per-user permissions
 * matrix cannot influence — that was the bug behind "I granted the page and
 * they still can't get in": the sidebar honoured `allowed_pages`, the page
 * itself did not, so a granted link led to a 403.
 *
 * Role checks are still the right tool for WRITES (server actions, RLS). This
 * only governs page ACCESS.
 */
export async function requirePage(pageKey: string): Promise<Profile> {
  const profile = await requireProfile();
  if (isPageAllowed(profile, pageKey)) return profile;
  redirect(fallbackPathFor(profile));
}

/**
 * Section-level variant: pass when ANY of the given pages is allowed. Used by
 * the Settings layout, which is a section rather than a page — each leaf still
 * calls requirePage() for its own key.
 */
export async function requireAnyPage(pageKeys: string[]): Promise<Profile> {
  const profile = await requireProfile();
  if (isAnyPageAllowed(profile, pageKeys)) return profile;
  redirect(fallbackPathFor(profile));
}

/**
 * Require that the caller is entitled to act on the given location.
 * Owner + co_owner + accountant pass for any location. Manager/staff must
 * match their assigned location. Employees fail.
 */
export async function requireLocation(locationId: string): Promise<Profile> {
  const profile = await requireProfile();

  if (profile.role === "employee") {
    throw new AuthorizationError("Employees cannot access location data");
  }
  if (profile.role === "portal_customer") {
    throw new AuthorizationError("Location mismatch");
  }

  // Covers all three modes at once (migration 0137): owner/co_owner/accountant
  // and anyone with cross_location get every location; a Multiple-mode user
  // gets their home shop plus each one ticked; everyone else just their home.
  if (!canAccessLocation(profile, locationId)) {
    throw new AuthorizationError("Location mismatch");
  }

  return profile;
}

/**
 * True for both owner and co_owner. The two roles are treated as functional
 * equivalents everywhere — co_owner exists so multiple humans can administer
 * the shop without sharing the bootstrap owner account.
 */
export function isOwner(profile: Profile | null): boolean {
  return profile?.role === "owner" || profile?.role === "co_owner";
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
 * Owner / co_owner / accountant — the cross-location admin roles.
 */
export function isCrossLocation(profile: Profile | null): boolean {
  return profile?.role === "owner" || profile?.role === "co_owner" || profile?.role === "accountant";
}
