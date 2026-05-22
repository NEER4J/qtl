import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/db/types";

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
    .select(
      "id, email, username, full_name, role, location_id, can_enter_expenses, active, last_login_at, created_at, updated_at, allowed_pages, hidden_columns, cross_location",
    )
    .eq("id", user.id)
    .maybeSingle();

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
