"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  ChangeOwnPasswordInput,
  UpdateOwnProfileInput,
} from "@/lib/schemas/profile";
import type { Profile } from "@/lib/db/types";

// ----------------------------------------------------------------------------
// Update own display name. Any signed-in user (no role gate) — they can only
// touch their own row. RLS still permits a user to update their own profile;
// the profiles_guard trigger blocks the privileged columns (role, location,
// allowed_pages…), so full_name is all that actually changes here.
// ----------------------------------------------------------------------------
export const updateOwnProfile = wrapAction({
  schema: UpdateOwnProfileInput,
  handler: async (input, profile): Promise<Profile> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: input.full_name })
      .eq("id", profile.id)
      .select("*")
      .single();
    if (error) throw error;
    // The sidebar footer and header both read full_name off the profile, so
    // refresh the whole app layout — not just /profile.
    revalidatePath("/", "layout");
    return data as Profile;
  },
});

// ----------------------------------------------------------------------------
// Change own password. Verifies the current password first, then updates the
// auth credential and keeps the admin-visible stored copy in sync.
// ----------------------------------------------------------------------------
export const changeOwnPassword = wrapAction({
  schema: ChangeOwnPasswordInput,
  handler: async (input, profile): Promise<{ updated: true }> => {
    // 1. Verify the current password. Sign in on a throwaway client whose
    //    cookie handlers are no-ops, so this attempt never mutates the live
    //    session. profile.email is always the auth-login email (a real email
    //    for owner/admin/accountant, the synthetic @team address otherwise).
    const verifier = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    const { error: signInErr } = await verifier.auth.signInWithPassword({
      email: profile.email,
      password: input.current_password,
    });
    if (signInErr) {
      throw new Error("Current password is incorrect");
    }

    // 2. Set the new password via the admin (service-role) client.
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(profile.id, {
      password: input.new_password,
    });
    if (error) throw error;

    // 3. Keep the admin-visible stored credential fresh. Non-fatal: the
    //    password has already changed, so a sync failure shouldn't surface as
    //    a failed password change.
    const { error: credErr } = await admin
      .from("profile_credentials")
      .upsert(
        {
          profile_id: profile.id,
          password_plain: input.new_password,
          set_by: profile.id,
        },
        { onConflict: "profile_id" },
      );
    if (credErr) {
      console.error("changeOwnPassword: credential sync failed:", credErr.message);
    }

    return { updated: true };
  },
});
