"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  CreateCustomerInput,
  SearchCustomersInput,
  UpdateCustomerInput,
} from "@/lib/schemas/customers";
import type { Customer, SalesJob } from "@/lib/db/types";

// ----------------------------------------------------------------------------
// List — used by /customers page
// ----------------------------------------------------------------------------
export async function listCustomers(): Promise<Customer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("billing_name");
  if (error) throw error;
  return (data ?? []) as Customer[];
}

// ----------------------------------------------------------------------------
// Deactivate / Reactivate
// ----------------------------------------------------------------------------
export const toggleCustomerActive = wrapAction({
  schema: z.object({ id: z.string().uuid(), active: z.boolean() }),
  roles: ["owner", "manager"],
  handler: async (input, profile): Promise<Customer> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .update({ active: input.active, updated_by: profile.id })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/customers");
    return data as Customer;
  },
});

// ----------------------------------------------------------------------------
// Search — used by the customer combobox on sales/new
// ----------------------------------------------------------------------------
export const searchCustomers = wrapAction({
  schema: SearchCustomersInput,
  handler: async (input): Promise<Customer[]> => {
    const supabase = await createClient();
    let query = supabase
      .from("customers")
      .select("*")
      .eq("active", true)
      .order("billing_name")
      .limit(input.limit);

    if (input.q) {
      // ilike for billing_name, plus a license-plate array contains
      const term = `%${input.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      const plateUpper = input.q.toUpperCase();
      query = query.or(
        `billing_name.ilike.${term},license_plates.cs.{${plateUpper}}`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Customer[];
  },
});

// ----------------------------------------------------------------------------
// Create
// ----------------------------------------------------------------------------
export const createCustomer = wrapAction({
  schema: CreateCustomerInput,
  roles: ["owner", "manager", "staff"],
  handler: async (input, profile): Promise<Customer> => {
    const supabase = await createClient();

    // If creating customer as staff/manager without an explicit home location,
    // default to their location so RLS reads stay scoped.
    const homeLocation = input.home_location_id
      ?? (profile.role === "owner" ? null : profile.location_id);

    const plates = Array.from(
      new Set(
        input.license_plates
          .map((p) => p.trim().toUpperCase())
          .filter((p) => p.length > 0),
      ),
    );

    const { data, error } = await supabase
      .from("customers")
      .insert({
        code: input.code?.trim() || null,
        billing_name: input.billing_name,
        contact_no: input.contact_no || null,
        email: input.email || null,
        license_plates: plates,
        home_location_id: homeLocation,
        notes: input.notes || null,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/customers");
    return data as Customer;
  },
});

// ----------------------------------------------------------------------------
// Update
// ----------------------------------------------------------------------------
export const updateCustomer = wrapAction({
  schema: UpdateCustomerInput,
  roles: ["owner", "manager"],
  handler: async (input, profile): Promise<Customer> => {
    const supabase = await createClient();
    const plates = Array.from(
      new Set(
        input.license_plates
          .map((p) => p.trim().toUpperCase())
          .filter((p) => p.length > 0),
      ),
    );

    const codeUpdate = input.code?.trim() ? { code: input.code.trim() } : {};

    const { data, error } = await supabase
      .from("customers")
      .update({
        ...codeUpdate,
        billing_name: input.billing_name,
        contact_no: input.contact_no || null,
        email: input.email || null,
        license_plates: plates,
        home_location_id: input.home_location_id,
        notes: input.notes || null,
        updated_by: profile.id,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/customers");
    return data as Customer;
  },
});

// ----------------------------------------------------------------------------
// Outstanding for a given customer (used by the previous-pending alert
// on sales/new). Sums outstanding across all their active jobs.
// ----------------------------------------------------------------------------
export interface CustomerOutstanding {
  customer_id: string;
  invoice_count: number;
  outstanding_total: number;
  recent: Array<{
    id: string;
    invoice_no: string;
    job_date: string;
    total: number;
    outstanding: number;
  }>;
}

export async function getCustomerOutstanding(
  customerId: string,
): Promise<CustomerOutstanding> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_jobs")
    .select("id, invoice_no, job_date, total, outstanding, payment_status")
    .eq("customer_id", customerId)
    .in("payment_status", ["outstanding", "partial"])
    .is("deactivated_at", null)
    .order("job_date", { ascending: false })
    .limit(5);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    invoice_no: string;
    job_date: string;
    total: number;
    outstanding: number;
  }>;

  return {
    customer_id: customerId,
    invoice_count: rows.length,
    outstanding_total: rows.reduce((sum, r) => sum + Number(r.outstanding ?? 0), 0),
    recent: rows,
  };
}

// ----------------------------------------------------------------------------
// Single customer fetch (for /customers/[id])
// ----------------------------------------------------------------------------
export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Customer;
}

// Sales history for a given customer
export async function getCustomerSalesHistory(
  customerId: string,
  limit = 50,
): Promise<SalesJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_jobs")
    .select("*")
    .eq("customer_id", customerId)
    .is("deactivated_at", null)
    .order("job_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SalesJob[];
}
