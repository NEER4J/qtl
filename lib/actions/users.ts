"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  InviteUserInput,
  ResetUserPasswordInput,
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
  handler: async (input): Promise<{ id: string; email: string }> => {
    const admin = createAdminClient();

    // Send magic-link invite. Supabase creates the auth user on invite and
    // our 0002 trigger inserts the matching profile row (role=staff default;
    // first user would become owner — but we're logged in already as owner so
    // that branch is not reached).
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/reset-password`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
      data: { full_name: input.full_name },
      redirectTo,
    });
    if (error) throw error;
    if (!data.user) throw new Error("Invite did not return a user");

    // Patch the profile with desired role, location, flags.
    const { error: updateErr } = await admin
      .from("profiles")
      .update({
        full_name: input.full_name,
        role: input.role,
        location_id: input.location_id,
        can_enter_expenses: input.can_enter_expenses,
        active: true,
      })
      .eq("id", data.user.id);
    if (updateErr) throw updateErr;

    revalidatePath("/settings/users");
    return { id: data.user.id, email: data.user.email ?? input.email };
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
// Reset password — sends a Supabase-hosted reset email to the user
// ----------------------------------------------------------------------------
export const resetUserPassword = wrapAction({
  schema: ResetUserPasswordInput,
  roles: ["owner"],
  handler: async (input): Promise<{ sent: true }> => {
    const admin = createAdminClient();
    const { data: { user }, error: getErr } = await admin.auth.admin.getUserById(input.id);
    if (getErr) throw getErr;
    if (!user?.email) throw new Error("User has no email on file");

    // Use the public (non-admin) API to generate the recovery email — the
    // admin API's generateLink also works but requires a more complex flow.
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/reset-password`;
    const { error } = await admin.auth.resetPasswordForEmail(user.email, { redirectTo });
    if (error) throw error;
    return { sent: true };
  },
});
