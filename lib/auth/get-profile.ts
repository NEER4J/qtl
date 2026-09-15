import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/db/types";

/** Every profile column the app reads, except the ones added by a migration
 *  that may not have run yet. Kept as one string so the primary read and the
 *  fallback below can never drift apart. */
const BASE_COLUMNS =
  "id, email, username, full_name, role, location_id, location_ids, can_enter_expenses, active, last_login_at, created_at, updated_at, allowed_pages, hidden_columns, cross_location";

/**
 * Read the current user's profile row. Cached per request.
 * Returns `null` if the user isn't signed in or has no profile yet.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(`${BASE_COLUMNS}, allowed_actions`)
    .eq("id", user.id)
    .maybeSingle();

  // `allowed_actions` arrives with migration 0140. If the app is deployed
  // before that migration runs, this select fails, every caller sees a null
  // profile, and requireProfile() redirects the whole shop to the login page —
  // a total lockout on a column nothing critical depends on. So on undefined
  // column (Postgres 42703) or a message naming the column, retry without it
  // and carry on: a missing value means "no override", which is what NULL
  // means anyway, so actions fall back to the role defaults until the
  // migration lands.
  const missingAllowedActions =
    error?.code === "42703" ||
    /allowed_actions/i.test(error?.message ?? "");
  if (missingAllowedActions) {
    const retry = await supabase
      .from("profiles")
      .select(BASE_COLUMNS)
      .eq("id", user.id)
      .maybeSingle();
    if (retry.error) {
      console.error("getCurrentProfile:", retry.error.message);
      return null;
    }
    if (!retry.data) return null;
    return { ...(retry.data as Omit<Profile, "allowed_actions">), allowed_actions: null };
  }

  if (error) {
    console.error("getCurrentProfile:", error.message);
    return null;
  }

  return (data as Profile | null) ?? null;
});

/**
 * Redirect to /auth/login if the user is not signed in; return profile otherwise.
 */
export async function getCurrentProfileOrRedirect(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login");
  if (!profile.active) redirect("/auth/login?error=account_disabled");
  return profile;
}
