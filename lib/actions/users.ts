"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  InviteUserInput,
  SetUserPasswordInput,
  ToggleUserActive,
  UpdateUserInput,
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
      "id, email, full_name, role, location_id, can_enter_expenses, active, last_login_at, created_at, updated_at, locations:location_id(name)",
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
    return { ...(rest as Profile), location_name: locationName };
  });
}

// ----------------------------------------------------------------------------
// Invite — admin creates auth user + profile via trigger, then patches role
// ----------------------------------------------------------------------------
export const inviteUser = wrapAction({
  schema: InviteUserInput,
  roles: ["owner"],
  handler: async (
    input,
  ): Promise<{ id: string; email: string; existed: boolean }> => {
    const admin = createAdminClient();

    // Idempotent: if the email already exists (e.g. retry after a prior
    // failure), patch the existing user's password + profile instead of
    // erroring.
    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = listData?.users.find(
      (u) => u.email?.toLowerCase() === input.email.toLowerCase(),
    );

    let userId: string;
    let existed = false;

    if (existing) {
      userId = existing.id;
      existed = true;
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
        password: input.password,
      });
      if (pwErr) throw pwErr;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: input.full_name },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Create did not return a user");
      userId = data.user.id;
    }

    // Ensure a profile row exists (upsert — covers the rare case where the
    // trigger didn't fire, e.g. on a user imported via SQL).
    const { error: upsertErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: input.email,
          full_name: input.full_name,
          role: input.role,
          location_id: input.location_id,
          can_enter_expenses: input.can_enter_expenses,
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
    return { id: userId, email: input.email, existed };
  },
});

// ----------------------------------------------------------------------------
// Update — edit role / location / name
// ----------------------------------------------------------------------------
export const updateUser = wrapAction({
  schema: UpdateUserInput,
  roles: ["owner"],
  handler: async (input): Promise<Profile> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: input.full_name,
        role: input.role,
        location_id: input.location_id,
        can_enter_expenses: input.can_enter_expenses,
        active: input.active,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/users");
    return data as Profile;
  },
});

// ----------------------------------------------------------------------------
// Activate / Deactivate
// ----------------------------------------------------------------------------
export const toggleUserActive = wrapAction({
  schema: ToggleUserActive,
  roles: ["owner"],
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
  roles: ["owner"],
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

    if (target?.role === "owner") {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "owner")
        .eq("active", true);
      if ((count ?? 0) <= 1) {
        throw new Error("Cannot delete the last active owner");
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
// Set password directly — owner sets a user's password from the dashboard.
// Also mirrors the plaintext into profile_credentials so the owner can recall
// it later from the users page. profile_credentials is owner-only via RLS.
// ----------------------------------------------------------------------------
export const setUserPassword = wrapAction({
  schema: SetUserPasswordInput,
  roles: ["owner"],
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
