import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Cross-request cache for reference data.
 *
 * Why this exists: the database is ~180ms away (see the region note in the
 * perf audit), and every page re-read the same handful of near-static tables
 * on every render. /sales/new alone fired six of these queries each time it
 * opened. None of that data changes more than a few times a month.
 *
 * ---------------------------------------------------------------------------
 * SECURITY — read this before adding anything to this file.
 * ---------------------------------------------------------------------------
 * Two rules, and both must hold for every entry here:
 *
 *  1. The table's SELECT policy must be `to authenticated using (true)`, i.e.
 *     every signed-in user sees byte-identical rows. Verified at the time of
 *     writing for: locations, service_types, expense_categories,
 *     expense_subcategories, app_settings (0007), oil_types, engine_types,
 *     service_costs (0015), part_categories, part_brands (0020) and
 *     technicians (0065).
 *
 *  2. The cached value must be role-independent. Cache the RAW rows, never a
 *     role-filtered projection. This is why `parts` is deliberately absent:
 *     listAllParts() strips cost / mhsw_fee / margin_value for non-owners, so
 *     caching its OUTPUT under a shared key would serve an owner's costs to
 *     staff. Its raw rows are readable by everyone, but the derived shape is
 *     not — so it stays uncached until it is split.
 *
 * The reads below run through the SERVICE-ROLE client, because an
 * unstable_cache callback may not touch cookies() and the RLS client is built
 * from the session cookie. That bypasses RLS entirely, which is only
 * acceptable because of rule 1 — a table whose rows differ per user must NEVER
 * be added here. If you tighten the RLS on any table listed above, remove it
 * from this file in the same change.
 *
 * If SUPABASE_SERVICE_ROLE_KEY is absent the getters fall back to an
 * uncached, RLS-scoped read through the caller's own session, so a missing env
 * var costs speed rather than breaking every page.
 */

/** Cache tags. Writers call revalidateReference() with the matching tag. */
export const REFERENCE_TAGS = {
  all: "ref",
  locations: "ref:locations",
  serviceTypes: "ref:service-types",
  expenseCategories: "ref:expense-categories",
  appSettings: "ref:app-settings",
  technicians: "ref:technicians",
  pricing: "ref:pricing",
} as const;

export type ReferenceTag = (typeof REFERENCE_TAGS)[keyof typeof REFERENCE_TAGS];

/**
 * Backstop expiry. Tag revalidation is the real mechanism — this only bounds
 * how long a *missed* revalidation can serve stale data. An hour is well
 * inside the tolerance for data edited a few times a month.
 */
const MAX_AGE_SECONDS = 3600;

// Loose client type: the service-role and the RLS clients expose the same
// query builder, and these reads only use the common subset.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

let warnedMissingKey = false;

/**
 * Wrap a reference read in a tag-invalidated, cross-request cache.
 *
 * `read` must produce the same value for every authenticated user — see the
 * security note above.
 */
function cachedReference<T>(
  name: string,
  tag: ReferenceTag,
  read: (db: Db) => Promise<T>,
): () => Promise<T> {
  const cached = unstable_cache(
    async () => read(createAdminClient() as Db),
    ["reference", name],
    { tags: [tag, REFERENCE_TAGS.all], revalidate: MAX_AGE_SECONDS },
  );

  return async () => {
    if (!hasServiceRoleKey()) {
      if (!warnedMissingKey) {
        warnedMissingKey = true;
        console.warn(
          "[cache/reference] SUPABASE_SERVICE_ROLE_KEY not set — reference data " +
            "is being read uncached on every request. Set it to restore caching.",
        );
      }
      return read((await createClient()) as Db);
    }
    return cached();
  };
}

/**
 * Drop cached reference data. Call from every action that writes one of the
 * tables above; without it an edit stays invisible for up to MAX_AGE_SECONDS.
 * Passing no tag clears everything, which is the safe default for a writer
 * that touches several tables at once.
 */
export function revalidateReference(tag: ReferenceTag = REFERENCE_TAGS.all): void {
  // Next 16 requires a cache-life profile alongside the tag. "max" is the
  // longest-lived one, which is what we want for a purge marker: it must
  // outlive any cached entry it is invalidating.
  //
  // revalidateTag rather than updateTag: every current caller is a Server
  // Action, where updateTag's read-your-own-writes would also work, but
  // revalidateTag is valid from route handlers too and so does not quietly
  // break if one of these writers is ever called from a cron or webhook. The
  // revalidatePath() call that accompanies each writer already refreshes the
  // page the editor is looking at.
  revalidateTag(tag, "max");
}

// ---------------------------------------------------------------------------
// Cached getters. Each mirrors the query its uncached counterpart used to run,
// column-for-column and order-for-order, so callers see no behavioural change.
// ---------------------------------------------------------------------------

export const getCachedActiveLocations = cachedReference(
  "active-locations",
  REFERENCE_TAGS.locations,
  async (db) => {
    const { data, error } = await db
      .from("locations")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
);

export const getCachedActiveServiceTypes = cachedReference(
  "active-service-types",
  REFERENCE_TAGS.serviceTypes,
  async (db) => {
    const { data, error } = await db
      .from("service_types")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
);

export const getCachedActiveExpenseCategories = cachedReference(
  "active-expense-categories",
  REFERENCE_TAGS.expenseCategories,
  async (db) => {
    const { data, error } = await db
      .from("expense_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
);

export const getCachedActiveExpenseSubcategories = cachedReference(
  "active-expense-subcategories",
  REFERENCE_TAGS.expenseCategories,
  async (db) => {
    const { data, error } = await db
      .from("expense_subcategories")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
);

export const getCachedAppSettings = cachedReference(
  "app-settings",
  REFERENCE_TAGS.appSettings,
  async (db) => {
    const { data, error } = await db.from("app_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  },
);

export const getCachedActiveTechnicians = cachedReference(
  "active-technicians",
  REFERENCE_TAGS.technicians,
  async (db) => {
    const { data, error } = await db
      .from("technicians")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
);

export const getCachedActiveOilTypes = cachedReference(
  "active-oil-types",
  REFERENCE_TAGS.pricing,
  async (db) => {
    const { data, error } = await db
      .from("oil_types")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
);

export const getCachedActiveEngineTypes = cachedReference(
  "active-engine-types",
  REFERENCE_TAGS.pricing,
  async (db) => {
    const { data, error } = await db
      .from("engine_types")
      .select("*")
      .eq("active", true)
      .order("manufacturer")
      .order("model");
    if (error) throw error;
    return data ?? [];
  },
);

export const getCachedActivePartCategories = cachedReference(
  "active-part-categories",
  REFERENCE_TAGS.pricing,
  async (db) => {
    const { data, error } = await db
      .from("part_categories")
      .select("id, name, unit_of_measure")
      .eq("active", true)
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
);

export const getCachedActivePartBrands = cachedReference(
  "active-part-brands",
  REFERENCE_TAGS.pricing,
  async (db) => {
    const { data, error } = await db
      .from("part_brands")
      .select("name")
      .eq("active", true)
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return ((data ?? []) as { name: string }[]).map((r) => r.name);
  },
);

export const getCachedServiceCosts = cachedReference(
  "service-costs",
  REFERENCE_TAGS.pricing,
  async (db) => {
    const { data, error } = await db.from("service_costs").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  },
);
