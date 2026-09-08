import type { Profile, UserRole } from "@/lib/db/types";
import {
  ACTION_REGISTRY,
  PAGE_REGISTRY,
  actionByKey,
  defaultAllowedActionsForRole,
  defaultAllowedPagesForRole,
  pageKeyForPath,
} from "./registry";

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

type ProfileSubset =
  | (Pick<Profile, "role" | "allowed_pages" | "hidden_columns"> &
      Partial<Pick<Profile, "allowed_actions">>)
  | null
  | undefined;

// Registry keys for the Pricing sub-pages, which were added AFTER the first
// `allowed_pages` overrides were saved. See applyLegacyPricingInheritance().
const PRICING_SUBPAGE_KEYS = PAGE_REGISTRY.filter(
  (p) => p.key !== "pricing" && p.path.startsWith("/pricing/"),
).map((p) => p.key);

/**
 * Back-compat shim for per-user overrides saved before the Pricing sub-pages
 * existed as their own registry keys.
 *
 * Such an override grants `pricing` and — because the keys did not exist when
 * it was written — none of the sub-pages. Read literally, that would strip the
 * entire Pricing menu's contents from every user with a custom allowlist the
 * moment this code deploys. So: when an override grants Pricing but mentions
 * no sub-page at all, we treat the sub-pages as unspecified and fall back to
 * the role's defaults for them (which is where "Oil detail is owner-only" now
 * lives).
 *
 * The shim stops firing as soon as the override names any sub-page — i.e.
 * after migration 0140 backfills it, or after an admin next saves that user in
 * the permissions matrix. It deliberately does NOT grant sub-pages to someone
 * whose override withholds `pricing` itself.
 */
function applyLegacyPricingInheritance(allowed: Set<string>, role: UserRole): Set<string> {
  if (!allowed.has("pricing")) return allowed;
  if (PRICING_SUBPAGE_KEYS.some((k) => allowed.has(k))) return allowed;
  const roleDefaults = new Set(defaultAllowedPagesForRole(role));
  for (const k of PRICING_SUBPAGE_KEYS) {
    if (roleDefaults.has(k)) allowed.add(k);
  }
  return allowed;
}

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
  const stored = profile.allowed_pages;
  if (!stored) return new Set(defaultAllowedPagesForRole(profile.role));
  return applyLegacyPricingInheritance(new Set(stored), profile.role);
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
// Actions
// ----------------------------------------------------------------------------
// Third axis alongside pages and columns — see ACTION_REGISTRY. Actions are
// gated on TOP of pages: you can never perform an action on a page you cannot
// open, no matter what the stored allowlist says.

export function effectiveAllowedActionKeys(profile: ProfileSubset): Set<string> {
  if (!profile) return new Set();
  if (isAdminProfile(profile)) return new Set(ACTION_REGISTRY.map((a) => a.key));
  // Same rule as pages: a stored per-user override wins, otherwise the role
  // defaults. `allowed_actions` is optional on the subset type so callers
  // holding an older/partial profile shape still resolve to role defaults
  // rather than silently losing every action.
  const stored = profile.allowed_actions;
  return new Set(stored ?? defaultAllowedActionsForRole(profile.role));
}

export function isActionAllowed(profile: ProfileSubset, actionKey: string): boolean {
  if (!profile) return false;
  if (isAdminProfile(profile)) return true;
  const action = actionByKey(actionKey);
  // An unregistered key is a caller bug. Deny rather than default-allow, so a
  // typo in a gate fails closed.
  if (!action) return false;
  if (!isPageAllowed(profile, action.pageKey)) return false;
  return effectiveAllowedActionKeys(profile).has(actionKey);
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
