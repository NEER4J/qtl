"use server";

import { revalidatePath } from "next/cache";

import { wrapAction } from "@/lib/actions/_utils";
import { createClient } from "@/lib/supabase/server";
import {
  CreateVendorPartInput,
  DeactivateVendorPartInput,
  UpdateVendorPartInput,
} from "@/lib/schemas/vendor-parts";
import type { VendorPart, VendorPartRow } from "@/lib/db/types";

// ----------------------------------------------------------------------------
// List active vendor_parts for a given vendor (used on vendor detail) or
// for a given part (used on part detail / suppliers tab).
// ----------------------------------------------------------------------------
export async function listVendorPartsForVendor(
  vendorId: string,
): Promise<VendorPartRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendor_parts")
    .select(
      "*, part:parts(id, brand, part_number, description, cost, list_price), vendor:vendors(id, name, code)",
    )
    .eq("vendor_id", vendorId)
    .is("deactivated_at", null)
    .order("is_preferred", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as VendorPartRow[];
}

export async function listVendorPartsForPart(
  partId: string,
): Promise<VendorPartRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendor_parts")
    .select(
      "*, part:parts(id, brand, part_number, description, cost, list_price), vendor:vendors(id, name, code)",
    )
    .eq("part_id", partId)
    .is("deactivated_at", null)
    .order("is_preferred", { ascending: false })
    .order("cost");
  if (error) throw error;
  return (data ?? []) as unknown as VendorPartRow[];
}

// ----------------------------------------------------------------------------
// Create / update / deactivate
// ----------------------------------------------------------------------------
export const createVendorPart = wrapAction({
  schema: CreateVendorPartInput,
  roles: ["owner", "manager", "accountant"],
  handler: async (input, profile): Promise<VendorPart> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vendor_parts")
      .insert({
        ...input,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(`/vendors/${input.vendor_id}`);
    return data as VendorPart;
  },
});

export const updateVendorPart = wrapAction({
  schema: UpdateVendorPartInput,
  roles: ["owner", "manager", "accountant"],
  handler: async (input, profile): Promise<VendorPart> => {
    const supabase = await createClient();
    const { id, ...rest } = input;
    const { data, error } = await supabase
      .from("vendor_parts")
      .update({ ...rest, updated_by: profile.id })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(`/vendors/${input.vendor_id}`);
    return data as VendorPart;
  },
});

export const deactivateVendorPart = wrapAction({
  schema: DeactivateVendorPartInput,
  roles: ["owner", "manager"],
  handler: async (input, profile): Promise<VendorPart> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vendor_parts")
      .update({ deactivated_at: new Date().toISOString(), updated_by: profile.id })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/vendors");
    return data as VendorPart;
  },
});
