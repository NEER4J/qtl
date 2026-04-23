// Thin wrapper around the Supabase admin (service-role) client. Used only to
// bootstrap the "import" auth user — everything else goes through `db.ts` /
// postgres.js for transaction support.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function getAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

const IMPORT_EMAIL = "import@qtl.internal";

/**
 * Ensure a system auth user exists so audit_log.actor_id is never null for
 * imported rows. Returns the user id.
 *
 * Safe to call repeatedly: creates on first run, fetches on subsequent runs.
 * Requires at least one human owner to already exist, otherwise the
 * `handle_new_auth_user` trigger would promote the system user to owner.
 */
export async function ensureImportUser(): Promise<string> {
  const admin = getAdmin();

  // Fast path: lookup by email via a scan of the admin user list. Supabase
  // admin SDK doesn't expose a direct getByEmail, so we page through.
  const existing = await findUserByEmail(admin, IMPORT_EMAIL);
  if (existing) return existing;

  // Guard: require at least one profile to exist, otherwise bootstrap logic
  // in handle_new_auth_user() would make this system user the Owner.
  const { count, error: countErr } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (countErr) throw new Error(`profiles count failed: ${countErr.message}`);
  if (!count || count < 1) {
    throw new Error(
      "No profiles exist yet. Create an Owner account via /auth/register before running the importer (otherwise the system user would be promoted to Owner).",
    );
  }

  const password = randomPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: IMPORT_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: "System Import", system: true },
  });
  if (error || !data.user) {
    throw new Error(`ensureImportUser: ${error?.message ?? "no user returned"}`);
  }
  return data.user.id;
}

async function findUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  // Page through up to a few hundred users — fine for this project.
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < perPage) break;
  }
  return null;
}

function randomPassword(): string {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    "A1!"
  );
}
