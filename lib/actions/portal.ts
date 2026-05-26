"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { wrapAction } from "@/lib/actions/_utils";
import { requireProfile } from "@/lib/auth/require";
import type { SalesJob } from "@/lib/db/types";

// ============================================================================
// Customer portal — server-side view helpers.
// RLS in 0013 already restricts what a portal_customer user can read.
// ============================================================================

export interface PortalInvoiceRow extends SalesJob {
  location_name: string | null;
}

export async function listMyInvoices(): Promise<PortalInvoiceRow[]> {
  await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sales_jobs")
    .select("*, locations:location_id(name)")
    .order("job_date", { ascending: false })
    .limit(200);
  if (error) throw error;

  type Row = SalesJob & { locations: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    location_name: r.locations?.name ?? null,
  }));
}

export async function getMyInvoice(invoiceId: string): Promise<PortalInvoiceRow | null> {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_jobs")
    .select("*, locations:location_id(name)")
    .eq("id", invoiceId)
    .single();
  if (error) return null;
  const r = data as SalesJob & { locations: { name: string } | null };
  return { ...r, location_name: r.locations?.name ?? null };
}

// ============================================================================
// Admin-side: grant portal access to a customer.
// Creates a portal_customer profile (via admin API) if one doesn't exist,
// then links it to the customer record.
// ============================================================================
export const grantPortalAccess = wrapAction({
  schema: z.object({
    customer_id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string().trim().min(1).max(120),
  }),
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<{ profile_id: string; link_id: string }> => {
    const admin = createAdminClient();
    const supabase = await createClient();

    // Look for an existing auth user with this email
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const matched = existing?.users.find((u) => u.email?.toLowerCase() === input.email.toLowerCase());

    let userId = matched?.id;
    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: input.email,
        email_confirm: true,
        user_metadata: { full_name: input.full_name },
      });
      if (createErr || !created.user) throw createErr ?? new Error("Failed to create portal user");
      userId = created.user.id;
    }

    // Ensure there is a profile row with portal_customer role
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profErr } = await admin
        .from("profiles")
        .insert({
          id: userId,
          email: input.email,
          full_name: input.full_name,
          role: "portal_customer",
          location_id: null,
          active: true,
        });
      if (profErr) throw profErr;
    } else if (existingProfile.role !== "portal_customer") {
      // Promote only non-auth roles to portal_customer if they haven't logged in as staff.
      // For safety, block re-assigning an existing staff user as a portal customer.
      throw new Error(`User ${input.email} already has role ${existingProfile.role}; cannot convert to portal customer.`);
    }

    // Link the profile to the customer (idempotent)
    const { data: link, error: linkErr } = await supabase
      .from("customer_portal_access")
      .upsert(
        { profile_id: userId, customer_id: input.customer_id, created_by: profile.id },
        { onConflict: "profile_id,customer_id", ignoreDuplicates: false },
      )
      .select("id")
      .single();
    if (linkErr) throw linkErr;

    revalidatePath(`/customers/${input.customer_id}`);
    return { profile_id: userId, link_id: (link as { id: string }).id };
  },
});

export const revokePortalAccess = wrapAction({
  schema: z.object({ link_id: z.string().uuid() }),
  roles: ["owner", "co_owner", "manager"],
  handler: async (input): Promise<{ ok: true }> => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("customer_portal_access")
      .delete()
      .eq("id", input.link_id);
    if (error) throw error;
    revalidatePath("/customers");
    return { ok: true };
  },
});

export async function listPortalAccessForCustomer(customerId: string): Promise<
  Array<{ id: string; profile_id: string; email: string; full_name: string; created_at: string }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_portal_access")
    .select("id, profile_id, created_at, profiles:profile_id(email, full_name)")
    .eq("customer_id", customerId);
  if (error) throw error;
  type R = { id: string; profile_id: string; created_at: string; profiles: { email: string; full_name: string } | null };
  return ((data ?? []) as unknown as R[]).map((r) => ({
    id: r.id,
    profile_id: r.profile_id,
    email: r.profiles?.email ?? "",
    full_name: r.profiles?.full_name ?? "",
    created_at: r.created_at,
  }));
}
