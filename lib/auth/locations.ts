import type { Profile, UserRole } from "@/lib/db/types";

// ----------------------------------------------------------------------------
// Location access — All / Single / Multiple
// ----------------------------------------------------------------------------
// Mirrors migration 0137. Three modes, derived from three columns rather than
// stored as an enum, so `location_id` keeps its original meaning everywhere:
//
//   All        cross_location = true                 → every location
//   Single     location_ids empty                    → just location_id
//   Multiple   location_ids = [a, b, …]              → those, incl. location_id
//
// `location_id` is the HOME location in every mode: the default when this user
// creates a record, and what reporting attributes them to. RLS always grants
// the home location on top of location_ids (the base 0007 policies do that),
// so the UI keeps home inside the ticked set — see locationIdsForSave().

export type LocationMode = "all" | "single" | "multi";

type ProfileSubset = Pick<
  Profile,
  "role" | "location_id" | "location_ids" | "cross_location"
> | null | undefined;

/**
 * Roles that reach every location by definition, regardless of the columns.
 * These are the ones with no Location field on the Users screen.
 */
const ALL_LOCATION_ROLES = new Set<UserRole>(["owner", "co_owner", "accountant"]);

export function isAllLocationRole(role: UserRole | undefined): boolean {
  return !!role && ALL_LOCATION_ROLES.has(role);
}

/** Which of the three modes this profile is in. */
export function locationMode(profile: ProfileSubset): LocationMode {
  if (!profile) return "single";
  if (isAllLocationRole(profile.role) || profile.cross_location) return "all";
  return (profile.location_ids?.length ?? 0) > 0 ? "multi" : "single";
}

/**
 * The locations this profile can act on.
 * `null` means EVERY location — callers must treat that as "no filter", not as
 * an empty list, or an all-locations user would see nothing.
 */
export function accessibleLocationIds(profile: ProfileSubset): string[] | null {
  if (!profile) return [];
  if (locationMode(profile) === "all") return null;

  const ids = new Set<string>();
  // Home location is always included: the base RLS policies grant it
  // independently of location_ids, so the app must agree or it would filter
  // out rows the database is happy to return.
  if (profile.location_id) ids.add(profile.location_id);
  for (const id of profile.location_ids ?? []) ids.add(id);
  return [...ids];
}

/** True when this profile may act on the given location. */
export function canAccessLocation(
  profile: ProfileSubset,
  locationId: string | null | undefined,
): boolean {
  const allowed = accessibleLocationIds(profile);
  if (allowed === null) return true;
  if (!locationId) return false;
  return allowed.includes(locationId);
}

/**
 * The location a new record should default to. Home location when there is
 * one; for all-locations users there is no sensible default, so null (the
 * form asks).
 */
export function defaultLocationId(profile: ProfileSubset): string | null {
  return profile?.location_id ?? null;
}

/**
 * Should this user get a location PICKER (filters, "which shop?" selects), or
 * is their view pinned to one shop? True for all-locations and multi-location
 * users — anyone with a real choice to make.
 */
export function canChooseLocation(profile: ProfileSubset): boolean {
  const allowed = accessibleLocationIds(profile);
  return allowed === null || allowed.length > 1;
}

/**
 * Narrow a requested location filter to what the user may actually see.
 * Returns `undefined` for "no filter" (all-locations user with no explicit
 * request) and otherwise the list to constrain the query to. Use with
 * `applyLocationFilter` so every list query scopes the same way.
 */
export function resolveLocationFilter(
  profile: ProfileSubset,
  requested: string | null | undefined,
): { ids: string[] | null } {
  const allowed = accessibleLocationIds(profile);
  if (requested) {
    // An explicit request is honoured only if it's within reach.
    if (allowed === null || allowed.includes(requested)) return { ids: [requested] };
    return { ids: allowed ?? [] };
  }
  return { ids: allowed };
}

/**
 * Filter a Supabase query builder by the user's accessible locations.
 * `null` ids = every location, so no filter is applied at all.
 */
export function applyLocationFilter<T extends {
  eq: (col: string, val: string) => T;
  in: (col: string, vals: readonly string[]) => T;
}>(query: T, column: string, ids: string[] | null): T {
  if (ids === null) return query;
  if (ids.length === 1) return query.eq(column, ids[0]);
  return query.in(column, ids);
}

/**
 * Normalise what the admin picked in the Users dialog into the three columns.
 *
 * `homeId` is the existing "Location" select — the user's home shop, required
 * for every location-scoped role exactly as before. `extraIds` is the extra
 * shops ticked in Multiple mode; home is always folded in because RLS grants
 * it regardless (the base 0007 policies match on location_id), so storing it
 * keeps the array and the effective access identical.
 *
 * A Multiple selection that ends up with one location collapses to Single, so
 * each state has exactly one representation in the database.
 */
export function locationAccessForSave(
  mode: LocationMode,
  homeId: string | null,
  extraIds: string[],
): { cross_location: boolean; location_id: string | null; location_ids: string[] | null } {
  if (mode === "all") {
    return { cross_location: true, location_id: homeId, location_ids: null };
  }
  if (mode === "multi") {
    const unique = [...new Set([homeId, ...extraIds].filter((v): v is string => !!v))];
    if (unique.length <= 1) {
      return { cross_location: false, location_id: homeId, location_ids: null };
    }
    return { cross_location: false, location_id: homeId, location_ids: unique };
  }
  return { cross_location: false, location_id: homeId, location_ids: null };
}
