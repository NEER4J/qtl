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
import type { Expense, Vendor } from "@/lib/db/types";

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
  roles: ["owner", "accountant", "manager"],
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
  roles: ["owner", "accountant", "manager"],
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
  roles: ["owner", "accountant", "manager"],
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
