import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Admin client — uses the service-role key, bypasses RLS.
 * NEVER import from any `"use client"` component. Server actions only.
 * Only used for administrative flows (user invites, migration scripts) that
 * cannot go through the user's own auth session.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin flows (user invites etc.)",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
