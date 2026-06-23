"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  ApplyDefaultPermissionsInput,
  BulkUserAction,
  InviteUserInput,
  SetUserPasswordInput,
  ToggleUserActive,
  UpdateUserInput,
  UpdateUserPermissionsInput,
  isUsernameRole,
  syntheticEmailForUsername,
} from "@/lib/schemas/users";
import type { Profile } from "@/lib/db/types";

// ----------------------------------------------------------------------------
// List — returns all profiles (owner only; enforced by RLS + page guard)
// ----------------------------------------------------------------------------
export interface UserListRow extends Profile {
  location_name: string | null;
}

export async function listUsers(): Promise<UserListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, username, full_name, role, location_id, can_enter_expenses, active, last_login_at, created_at, updated_at, allowed_pages, hidden_columns, cross_location, locations:location_id(name)",
    )
    .order("role")
    .order("full_name");
  if (error) throw error;

  return (data ?? []).map((row) => {
    const loc = row.locations as { name: string | null } | { name: string | null }[] | null;
    const locationName = Array.isArray(loc)
      ? (loc[0]?.name ?? null)
      : (loc?.name ?? null);

    // Strip the joined relation before returning so the shape matches Profile + location_name.
    const { locations: _locations, ...rest } = row as typeof row & { locations: unknown };
    void _locations;
    return { ...(rest as Profile), location_name: locationName };
  });
}

// ----------------------------------------------------------------------------
// Invite — admin creates auth user + profile via trigger, then patches role
// ----------------------------------------------------------------------------
export const inviteUser = wrapAction({
  schema: InviteUserInput,
  roles: ["owner", "co_owner"],
  handler: async (
    input,
  ): Promise<{ id: string; identity: string; existed: boolean }> => {
    const admin = createAdminClient();

    // Resolve the auth-email Supabase will use. Username roles may OPTIONALLY
    // supply a real email — if present it becomes the actual auth email (so
    // they can sign in with username or email); otherwise a synthetic address
    // keeps signInWithPassword working.
    const usingUsername = isUsernameRole(input.role) && !!input.username;
    const authEmail = usingUsername
      ? (input.email ?? syntheticEmailForUsername(input.username!))
      : (input.email as string);

    const identity = usingUsername ? input.username! : authEmail;

    // Idempotent: if the auth user already exists (e.g. retry after a prior
    // failure), patch the existing user's password + profile instead of
    // erroring.
    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = listData?.users.find(
      (u) => u.email?.toLowerCase() === authEmail.toLowerCase(),
    );

    let userId: string;
    let existed = false;

    if (existing) {
      userId = existing.id;
      existed = true;
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
        password: input.password,
        user_metadata: {
          full_name: input.full_name,
          ...(usingUsername ? { username: input.username } : {}),
        },
      });
      if (pwErr) throw pwErr;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: authEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: input.full_name,
          ...(usingUsername ? { username: input.username } : {}),
        },
      });
      if (error) {
        console.error("[inviteUser] auth.admin.createUser failed", {
          authEmail,
          role: input.role,
          status: error.status,
          code: (error as { code?: string }).code,
          message: error.message,
        });
        throw new Error(
          `Could not create the auth user. If you just deployed, confirm migration 0060_username_and_permissions.sql has been applied. Underlying error: ${error.message}`,
        );
      }
      if (!data.user) throw new Error("Create did not return a user");
      userId = data.user.id;
    }

    // profiles.email must equal the auth email (it's what
    // auth_email_for_username resolves to). That's the real email when one was
    // supplied, otherwise the synthetic address.
    const profileEmail = authEmail;

    // Ensure a profile row exists (upsert — covers the rare case where the
    // trigger didn't fire, e.g. on a user imported via SQL).
    const { error: upsertErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: profileEmail,
          username: input.username ?? null,
          full_name: input.full_name,
          role: input.role,
          location_id: input.location_id,
          can_enter_expenses: input.can_enter_expenses,
          cross_location: input.cross_location,
          allowed_pages: input.allowed_pages ?? null,
          hidden_columns: input.hidden_columns ?? {},
          active: true,
        },
        { onConflict: "id" },
      );
    if (upsertErr) throw upsertErr;

    // Mirror the plaintext into profile_credentials so the owner can recall
    // it from the users page. RLS on profile_credentials restricts SELECT to
    // owner-only.
    const { error: credErr } = await admin
      .from("profile_credentials")
      .upsert(
        { profile_id: userId, password_plain: input.password },
        { onConflict: "profile_id" },
      );
    if (credErr) throw credErr;

    revalidatePath("/settings/users");
    revalidatePath("/", "layout");
    return { id: userId, identity, existed };
  },
});

// ----------------------------------------------------------------------------
// Update — edit role / location / name + identity + permissions
// ----------------------------------------------------------------------------
export const updateUser = wrapAction({
  schema: UpdateUserInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<Profile> => {
    const admin = createAdminClient();
    const supabase = await createClient();

    const usingUsername = isUsernameRole(input.role) && !!input.username;
    // Username roles keep a real email if one is supplied, else synthetic.
    const authEmail = usingUsername
      ? (input.email ?? syntheticEmailForUsername(input.username!))
      : (input.email as string);

    // Sync the auth.users email if it diverges from what we'd compute now.
    // This handles role flips (e.g. staff → accountant or vice versa) where
    // the underlying email must change to keep signInWithPassword consistent.
    const { data: existingUser } = await admin.auth.admin.getUserById(input.id);
    if (existingUser?.user) {
      if (existingUser.user.email?.toLowerCase() !== authEmail.toLowerCase()) {
        const { error: emailErr } = await admin.auth.admin.updateUserById(input.id, {
          email: authEmail,
          email_confirm: true,
        });
        if (emailErr) throw emailErr;
      }
    }

    const profileEmail = authEmail;

    const { data, error } = await supabase
      .from("profiles")
      .update({
        email: profileEmail,
        username: input.username ?? null,
        full_name: input.full_name,
        role: input.role,
        location_id: input.location_id,
        can_enter_expenses: input.can_enter_expenses,
        cross_location: input.cross_location,
        active: input.active,
        allowed_pages: input.allowed_pages ?? null,
        hidden_columns: input.hidden_columns ?? {},
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/users");
    revalidatePath("/", "layout");
    return data as Profile;
  },
});

// ----------------------------------------------------------------------------
// Permissions-only update — used by the matrix UI's Save button.
// ----------------------------------------------------------------------------
export const updateUserPermissions = wrapAction({
  schema: UpdateUserPermissionsInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<Profile> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        allowed_pages: input.allowed_pages ?? null,
        hidden_columns: input.hidden_columns ?? {},
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/users");
    revalidatePath("/", "layout");
    return data as Profile;
  },
});

// ----------------------------------------------------------------------------
// Apply role-default permissions to one or more users.
// Clears the per-user override (allowed_pages = NULL, hidden_columns = {}) so
// each selected user falls back to their role's defaults — the staff access
// matrix in lib/permissions/registry.ts. Owner-only, like the other writes.
// ----------------------------------------------------------------------------
export const applyDefaultPermissions = wrapAction({
  schema: ApplyDefaultPermissionsInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<{ affected: number }> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ allowed_pages: null, hidden_columns: {} })
      .in("id", input.ids)
      .select("id");
    if (error) throw error;
    revalidatePath("/settings/users");
    revalidatePath("/", "layout");
    return { affected: data?.length ?? 0 };
  },
});

// ----------------------------------------------------------------------------
// Activate / Deactivate
// ----------------------------------------------------------------------------
export const toggleUserActive = wrapAction({
  schema: ToggleUserActive,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<Profile> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/users");
    revalidatePath("/", "layout");
    return data as Profile;
  },
});

// ----------------------------------------------------------------------------
// Hard delete — removes the auth user, which cascades to profiles via
// `on delete cascade`. Internal tool; no soft-delete semantics needed.
// Safeguards: can't delete yourself, can't delete the last owner.
// ----------------------------------------------------------------------------
import { z } from "zod";

export const deleteUser = wrapAction({
  schema: z.object({ id: z.string().uuid() }),
  roles: ["owner", "co_owner"],
  handler: async (input, profile): Promise<{ deleted: true }> => {
    if (input.id === profile.id) {
      throw new Error("You can't delete your own account");
    }

    const supabase = await createClient();
    const { data: target, error: targetErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", input.id)
      .single();
    if (targetErr) throw targetErr;

    // Safeguard: at least one active owner OR co_owner must remain. Both
    // roles are functional admins; we don't strand the shop with only
    // restricted accounts. Co_owner counts toward the "last admin" floor.
    if (target?.role === "owner" || target?.role === "co_owner") {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .in("role", ["owner", "co_owner"])
        .eq("active", true);
      if ((count ?? 0) <= 1) {
        throw new Error("Cannot delete the last active owner or co-owner");
      }
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(input.id);
    if (error) throw error;

    revalidatePath("/settings/users");
    return { deleted: true };
  },
});

// ----------------------------------------------------------------------------
// Bulk action — deactivate / reactivate / delete in one shot.
// Same safeguards as the single-row variants.
// ----------------------------------------------------------------------------
export const bulkUserAction = wrapAction({
  schema: BulkUserAction,
  roles: ["owner", "co_owner"],
  handler: async (input, profile): Promise<{ affected: number }> => {
    if (input.ids.includes(profile.id)) {
      throw new Error("You can't include your own account in a bulk action");
    }

    const supabase = await createClient();

    if (input.action === "deactivate" || input.action === "reactivate") {
      const { data, error } = await supabase
        .from("profiles")
        .update({ active: input.action === "reactivate" })
        .in("id", input.ids)
        .select("id");
      if (error) throw error;
      revalidatePath("/settings/users");
      revalidatePath("/", "layout");
      return { affected: data?.length ?? 0 };
    }

    // Delete branch — protect the last active owner/co_owner. We pull both
    // roles together because they share the admin floor (see deleteUser).
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["owner", "co_owner"])
      .eq("active", true);
    const adminIds = new Set((admins ?? []).map((o) => o.id));
    const includesAllAdmins = [...adminIds].every((id) => input.ids.includes(id));
    if (adminIds.size > 0 && includesAllAdmins) {
      throw new Error("Bulk delete would remove every active owner / co-owner");
    }

    const admin = createAdminClient();
    let affected = 0;
    for (const id of input.ids) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (!error) affected += 1;
    }
    revalidatePath("/settings/users");
    revalidatePath("/", "layout");
    return { affected };
  },
});

// ----------------------------------------------------------------------------
// Set password directly — owner sets a user's password from the dashboard.
// Also mirrors the plaintext into profile_credentials so the owner can recall
// it later from the users page. profile_credentials is owner-only via RLS.
// ----------------------------------------------------------------------------
export const setUserPassword = wrapAction({
  schema: SetUserPasswordInput,
  roles: ["owner", "co_owner"],
  handler: async (input, profile): Promise<{ updated: true }> => {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(input.id, {
      password: input.password,
    });
    if (error) throw error;
    const { error: credErr } = await admin
      .from("profile_credentials")
      .upsert(
        { profile_id: input.id, password_plain: input.password, set_by: profile.id },
        { onConflict: "profile_id" },
      );
    if (credErr) throw credErr;
    revalidatePath("/settings/users");
    return { updated: true };
  },
});

// ----------------------------------------------------------------------------
// List stored plaintext passwords (owner only via RLS). Returns a map of
// profile_id → {password, set_at, set_by}. Only includes users whose password
// the owner has set/reset via this dashboard — users who haven't been touched
// since 0058_profile_credentials.sql shipped will be absent.
// ----------------------------------------------------------------------------
export interface StoredCredential {
  profile_id: string;
  password_plain: string;
  set_at: string;
  set_by: string | null;
}

export async function listUserPasswords(): Promise<StoredCredential[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_credentials")
    .select("profile_id, password_plain, set_at, set_by");
  // RLS denies for non-owners — return empty silently rather than throwing.
  if (error) return [];
  return (data ?? []) as StoredCredential[];
}
