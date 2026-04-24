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
// Set password directly — owner sets a user's password from the dashboard
// ----------------------------------------------------------------------------
export const setUserPassword = wrapAction({
  schema: SetUserPasswordInput,
  roles: ["owner"],
  handler: async (input): Promise<{ updated: true }> => {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(input.id, {
      password: input.password,
    });
    if (error) throw error;
    return { updated: true };
  },
});
