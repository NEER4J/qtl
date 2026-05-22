import type { Profile, UserRole } from "@/lib/db/types";
import { defaultAllowedPagesForRole, pageKeyForPath } from "./registry";

// ----------------------------------------------------------------------------
// Per-user permission checks
// ----------------------------------------------------------------------------
// Centralised so every gate (sidebar, page guards, table columns) reads from
// the same source of truth. Owner role bypasses every check by design.

type ProfileSubset = Pick<Profile, "role" | "allowed_pages" | "hidden_columns"> | null | undefined;

export function effectiveAllowedPageKeys(profile: ProfileSubset): Set<string> {
  if (!profile) return new Set();
  if (profile.role === "owner") {
    // Owner gets everything — a special sentinel set; consumers should check
    // isOwnerProfile first, but returning a populated set is also fine.
    return new Set();
  }
  const allowed = profile.allowed_pages ?? defaultAllowedPagesForRole(profile.role);
  return new Set(allowed);
}

export function isOwnerProfile(profile: ProfileSubset): boolean {
  return profile?.role === "owner";
}

export function isPageAllowed(profile: ProfileSubset, pageKey: string): boolean {
  if (!profile) return false;
  if (isOwnerProfile(profile)) return true;
  const set = effectiveAllowedPageKeys(profile);
  return set.has(pageKey);
}

export function isPathAllowed(profile: ProfileSubset, path: string): boolean {
  const key = pageKeyForPath(path);
  if (!key) return true; // unknown paths aren't permission-gated
  return isPageAllowed(profile, key);
}

// ----------------------------------------------------------------------------
// Columns
// ----------------------------------------------------------------------------

export function hiddenColumnsForPage(profile: ProfileSubset, pageKey: string): Set<string> {
  if (!profile || isOwnerProfile(profile)) return new Set();
  const arr = profile.hidden_columns?.[pageKey] ?? [];
  return new Set(arr);
}

export function isColumnVisible(profile: ProfileSubset, pageKey: string, columnKey: string): boolean {
  if (!profile) return false;
  if (isOwnerProfile(profile)) return true;
  return !hiddenColumnsForPage(profile, pageKey).has(columnKey);
}

/**
 * Filter an ordered list of column keys down to those the user can see.
 * Useful for tables that render via .map() over a column-key array.
 */
export function visibleColumnKeys<T extends string>(
  profile: ProfileSubset,
  pageKey: string,
  allKeys: readonly T[],
): T[] {
  if (!profile) return [];
  if (isOwnerProfile(profile)) return [...allKeys];
  const hidden = hiddenColumnsForPage(profile, pageKey);
  return allKeys.filter((k) => !hidden.has(k));
}

// ----------------------------------------------------------------------------
// Roles still get used for the older role-only gates (RLS-mirroring). The
// new system layers ON TOP of these — both must pass.
// ----------------------------------------------------------------------------
export function hasRole(profile: ProfileSubset, ...roles: UserRole[]): boolean {
  return !!profile && roles.includes(profile.role);
}
