import type { Profile, UserRole } from "@/lib/db/types";
import {
  ACTION_REGISTRY,
  PAGE_FAMILIES,
  PAGE_REGISTRY,
  UPDATE_ROLES,
  actionByKey,
  defaultAllowedActionsForRole,
  defaultAllowedPagesForRole,
  pageKeyForPath,
  roleCanUpdatePage,
  updateActionKey,
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

/**
 * Saved with every permissions-matrix save, in both `allowed_pages` and
 * `allowed_actions`, since sheets got their own keys and pages got Update rights
 * (client 2026-10-20). It tells a deliberate "all off" apart from an override
 * written before either existed — only the latter gets the fill-ins below. Not a
 * page or an action: the expanders drop it, so nothing else ever sees it.
 */
export const PERMISSIONS_MARKER = "perm:v2";

/**
 * Back-compat for per-user overrides saved before a page was split into its own
 * sub-pages (PAGE_FAMILIES): Pricing's sheets, the Pricing Catalogue's sheets,
 * the analytics and report sheets, payroll employees.
 *
 * Such an override grants the parent and — because the child keys did not
 * exist when it was written — none of the children. Read literally, that would
 * strip those sheets from every user with a custom allowlist the moment the
 * split deploys. So: when an override grants a parent but names none of its
 * children, the children are filled in (from the role defaults or all of them,
 * per family). It never grants children to someone whose override withholds
 * the parent itself, and it stops for good once an admin saves that user in the
 * permissions matrix: the matrix runs the same expansion first (so nothing is
 * lost on save) and writes PERMISSIONS_MARKER, after which a sheet left
 * unticked stays off.
 */
export function expandSavedPages(stored: Iterable<string>, role: UserRole): Set<string> {
  const allowed = new Set(stored);
  if (allowed.delete(PERMISSIONS_MARKER)) return allowed;
  const roleDefaults = new Set(defaultAllowedPagesForRole(role));
  for (const family of PAGE_FAMILIES) {
    if (!allowed.has(family.parent)) continue;
    if (family.children.some((k) => allowed.has(k))) continue;
    for (const k of family.children) {
      if (family.fill === "all" || roleDefaults.has(k)) allowed.add(k);
    }
  }
  return allowed;
}

/**
 * Same idea for Update rights: an action override saved before they existed
 * names no `<page>.update` key, and must not turn every page view-only, so the
 * role's default Update rights apply to it. A matrix save carries the marker
 * and is read as written — every Update switched off means view only.
 */
export function expandSavedActions(stored: Iterable<string>, role: UserRole): Set<string> {
  const allowed = new Set(stored);
  if (allowed.delete(PERMISSIONS_MARKER)) return allowed;
  const updateKeys = ACTION_REGISTRY.filter((a) => a.isUpdate).map((a) => a.key);
  if (updateKeys.some((k) => allowed.has(k))) return allowed;
  for (const a of ACTION_REGISTRY) {
    if (a.isUpdate && a.defaultRoles.includes(role)) allowed.add(a.key);
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
  return expandSavedPages(stored, profile.role);
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
  return stored ? expandSavedActions(stored, profile.role) : new Set(defaultAllowedActionsForRole(profile.role));
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

/**
 * Can this person change things on the page? View (the page) plus its Update
 * right. Restrict-only: a role that can't write there never can, whatever the
 * switch says. Pages with nothing to change answer with View alone.
 */
export function canUpdatePage(profile: ProfileSubset, pageKey: string): boolean {
  if (!profile) return false;
  if (isAdminProfile(profile)) return true;
  if (!UPDATE_ROLES[pageKey]) return isPageAllowed(profile, pageKey);
  if (!roleCanUpdatePage(profile.role, pageKey)) return false;
  return isActionAllowed(profile, updateActionKey(pageKey));
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
