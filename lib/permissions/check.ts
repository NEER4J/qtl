import type { Profile, UserRole } from "@/lib/db/types";
import { PAGE_REGISTRY, defaultAllowedPagesForRole, pageKeyForPath } from "./registry";

// ----------------------------------------------------------------------------
// Per-user permission checks
// ----------------------------------------------------------------------------
// Centralised so every gate (sidebar, page guards, table columns) reads from
// the same source of truth.
//
//   co_owner ("Admin")  → bypasses every check; full access incl. Settings.
//   owner               → full access EXCEPT the Settings section, which the
//                         Admin manages. Owner is no longer a blanket bypass
//                         for page access (but still sees all columns).
//   everyone else       → role default / per-user allowlist as before.

type ProfileSubset = Pick<Profile, "role" | "allowed_pages" | "hidden_columns"> | null | undefined;

// Keys of every page that belongs to the Settings section. Owner does not get
// these; the Admin (co_owner) does.
const SETTINGS_PAGE_KEYS = new Set(
  PAGE_REGISTRY.filter((p) => p.group === "Settings").map((p) => p.key),
);

export function effectiveAllowedPageKeys(profile: ProfileSubset): Set<string> {
  if (!profile) return new Set();
  if (isAdminProfile(profile)) {
    // Admin (co_owner) gets EVERY registered page. Returning the full keyset
    // (rather than an empty "sentinel" set) means callers who forget to
    // special-case admin still get the correct answer instead of silently
    // locking them out.
    return new Set(PAGE_REGISTRY.map((p) => p.key));
  }
  // Everyone else — owner included — goes through the same rule: a stored
  // per-user override wins, otherwise the role's registry defaults.
  //
  // Owner used to short-circuit here with a hard-coded "all pages minus
  // Settings" set, which meant a stored allowed_pages override was silently
  // discarded for owners: you could tick extra pages in the matrix, save
  // them, and nothing changed. The owner's default is unchanged (no Settings
  // group in defaultRoles for those keys) — it just comes from the registry
  // now, so an explicit grant actually takes effect.
  const allowed = profile.allowed_pages ?? defaultAllowedPagesForRole(profile.role);
  return new Set(allowed);
}

/** The "Admin": co_owner has unrestricted access to every page and column. */
export function isAdminProfile(profile: ProfileSubset): boolean {
  return profile?.role === "co_owner";
}

/** Owner: full access EXCEPT the Settings section. */
export function isOwnerProfile(profile: ProfileSubset): boolean {
  return profile?.role === "owner";
}

/** Owner + Admin both see every column (no column-hiding applies to them). */
function bypassesColumnHiding(profile: ProfileSubset): boolean {
  return isAdminProfile(profile) || isOwnerProfile(profile);
}

export function isPageAllowed(profile: ProfileSubset, pageKey: string): boolean {
  if (!profile) return false;
  if (isAdminProfile(profile)) return true;
  // Owner and everyone else go through the effective allowlist.
  return effectiveAllowedPageKeys(profile).has(pageKey);
}

/** True when the user can reach at least one of the given pages. */
export function isAnyPageAllowed(profile: ProfileSubset, pageKeys: string[]): boolean {
  return pageKeys.some((k) => isPageAllowed(profile, k));
}

/** Every registry key in the Settings section. */
export function settingsPageKeys(): string[] {
  return [...SETTINGS_PAGE_KEYS];
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
  if (!profile || bypassesColumnHiding(profile)) return new Set();
  const arr = profile.hidden_columns?.[pageKey] ?? [];
  return new Set(arr);
}

export function isColumnVisible(profile: ProfileSubset, pageKey: string, columnKey: string): boolean {
  if (!profile) return false;
  if (bypassesColumnHiding(profile)) return true;
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
  if (bypassesColumnHiding(profile)) return [...allKeys];
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
