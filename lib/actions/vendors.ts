"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  CreateVendorInput,
  SearchVendorsInput,
  UpdateVendorInput,
} from "@/lib/schemas/vendors";
import {
  DeleteVendorLocationInput,
  UpsertVendorLocationInput,
} from "@/lib/schemas/vendor-locations";
import type { Expense, Vendor, VendorLocation } from "@/lib/db/types";

// ----------------------------------------------------------------------------
// Search
// ----------------------------------------------------------------------------
export const searchVendors = wrapAction({
  schema: SearchVendorsInput,
  handler: async (input): Promise<Vendor[]> => {
    const supabase = await createClient();
    let query = supabase
      .from("vendors")
      .select("*")
      .eq("active", true)
      .order("name")
      .limit(input.limit);

    if (input.q) {
      const term = `%${input.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      query = query.ilike("name", term);
    }
    if (input.category_id) {
      query = query.eq("category_id", input.category_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Vendor[];
  },
});

// ----------------------------------------------------------------------------
// List (for /vendors page)
// ----------------------------------------------------------------------------
export async function listVendors(): Promise<Vendor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Vendor[];
}

// ----------------------------------------------------------------------------
// Create
// ----------------------------------------------------------------------------
export const createVendor = wrapAction({
  schema: CreateVendorInput,
  roles: ["owner", "co_owner", "accountant", "manager"],
  handler: async (input, profile): Promise<Vendor> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vendors")
      .insert({
        code: input.code?.trim() || null,
        name: input.name,
        contact_no: input.contact_no || null,
        email: input.email || null,
        account_no: input.account_no || null,
        account_type: input.account_type || null,
        category_id: input.category_id,
        notes: input.notes || null,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/vendors");
    return data as Vendor;
  },
});

// ----------------------------------------------------------------------------
// Deactivate / Reactivate
// ----------------------------------------------------------------------------
export const toggleVendorActive = wrapAction({
  schema: z.object({ id: z.string().uuid(), active: z.boolean() }),
  roles: ["owner", "co_owner", "accountant", "manager"],
  handler: async (input, profile): Promise<Vendor> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vendors")
      .update({ active: input.active, updated_by: profile.id })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/vendors");
    return data as Vendor;
  },
});

// ----------------------------------------------------------------------------
// Update
// ----------------------------------------------------------------------------
export const updateVendor = wrapAction({
  schema: UpdateVendorInput,
  roles: ["owner", "co_owner", "accountant", "manager"],
  handler: async (input, profile): Promise<Vendor> => {
    const supabase = await createClient();
    const codeUpdate = input.code?.trim() ? { code: input.code.trim() } : {};
    const { data, error } = await supabase
      .from("vendors")
      .update({
        ...codeUpdate,
        name: input.name,
        contact_no: input.contact_no || null,
        email: input.email || null,
        account_no: input.account_no || null,
        account_type: input.account_type || null,
        category_id: input.category_id,
        notes: input.notes || null,
        updated_by: profile.id,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/vendors");
    return data as Vendor;
  },
});

// ----------------------------------------------------------------------------
// Single vendor fetch (for /vendors/[id])
// ----------------------------------------------------------------------------
export async function getVendor(id: string): Promise<Vendor | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Vendor;
}

export async function getVendorExpenseHistory(
  vendorId: string,
  limit = 50,
): Promise<Expense[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("vendor_id", vendorId)
    .is("deactivated_at", null)
    .order("expense_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Expense[];
}

// ----------------------------------------------------------------------------
// Vendor per-location data (item #16)
// ----------------------------------------------------------------------------
export async function getVendorLocations(vendorId: string): Promise<VendorLocation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendor_locations")
    .select("*")
    .eq("vendor_id", vendorId);
  if (error) throw error;
  return (data ?? []) as VendorLocation[];
}

// Pull a single (vendor, location) row — used by the expense form when a
// vendor + location are both chosen so the per-location account number / sales
// rep prefills.
export async function getVendorLocationDetails(
  vendorId: string,
  locationId: string,
): Promise<VendorLocation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendor_locations")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("location_id", locationId)
    .maybeSingle();
  if (error) throw error;
  return (data as VendorLocation | null) ?? null;
}

export const upsertVendorLocation = wrapAction({
  schema: UpsertVendorLocationInput,
  roles: ["owner", "co_owner", "accountant", "manager"],
  handler: async (input, profile): Promise<VendorLocation> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vendor_locations")
      .upsert(
        {
          vendor_id: input.vendor_id,
          location_id: input.location_id,
          account_no: input.account_no,
          account_type: input.account_type,
          contact_no: input.contact_no,
          email: input.email,
          sales_rep_name: input.sales_rep_name,
          notes: input.notes,
          updated_by: profile.id,
          created_by: profile.id,
        },
        { onConflict: "vendor_id,location_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/vendors");
    revalidatePath(`/vendors/${input.vendor_id}`);
    return data as VendorLocation;
  },
});

export const deleteVendorLocation = wrapAction({
  schema: DeleteVendorLocationInput,
  roles: ["owner", "co_owner", "accountant"],
  handler: async (input): Promise<{ vendor_id: string; location_id: string }> => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("vendor_locations")
      .delete()
      .eq("vendor_id", input.vendor_id)
      .eq("location_id", input.location_id);
    if (error) throw error;
    revalidatePath(`/vendors/${input.vendor_id}`);
    return input;
  },
});
