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
import { digitsOnly } from "@/lib/utils/phone";

// Pull only the fields we want to write — the rest come from defaults / triggers.
function customerWritablePayload(input: z.infer<typeof CreateCustomerInput>) {
  const billing_name = input.billing_name ?? input.last_or_company ?? null;

  return {
    code: input.code ?? null,
    salutation: input.salutation,
    last_or_company: input.last_or_company,
    billing_name,
    address_1: input.address_1,
    address_2: input.address_2,
    city: input.city,
    province: input.province,
    country: input.country,
    postal_code: input.postal_code,
    contact_no: input.contact_no,
    phone_home: input.phone_home,
    phone_cell: input.phone_cell,
    phone_business: input.phone_business,
    phone_business_ext: input.phone_business_ext,
    phone_fax: input.phone_fax,
    phone_alt_1: input.phone_alt_1,
    phone_alt_2: input.phone_alt_2,
    phone_notes: input.phone_notes ?? {},
    email: input.email,
    other_contact: input.other_contact,
    comments: input.comments,
    contact_method: input.contact_method,
    customer_type: input.customer_type,
    card_number: input.card_number,
    default_pay_method: input.default_pay_method ?? null,
    cod_required: input.cod_required,
    labour_discount_pct: input.labour_discount_pct,
    parts_discount_pct: input.parts_discount_pct,
    late_payment_pct: input.late_payment_pct,
    late_payment_days: input.late_payment_days,
    calc_interest_from: input.calc_interest_from,
    special_hst_rate_pct: input.special_hst_rate_pct ?? null,
    pays_hst: input.pays_hst,
    free_oil_change_until: input.free_oil_change_until,
    notes: input.notes,
  };
}

// Item #29 — owner/manager grants a 30-day free oil-change offer.
export const grantFreeOilChange = wrapAction({
  schema: z.object({ customer_id: z.string().uuid() }),
  roles: ["owner", "manager"],
  handler: async (input, profile): Promise<Customer> => {
    const supabase = await createClient();
    const until = new Date();
    until.setDate(until.getDate() + 30);
    const untilISO = until.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("customers")
      .update({ free_oil_change_until: untilISO, updated_by: profile.id })
      .eq("id", input.customer_id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/customers");
    revalidatePath(`/customers/${input.customer_id}`);
    return data as Customer;
  },
});

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
// Item #8: also matches against customers.phone_search (digits-only).
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
      const term = `%${input.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      const plateUpper = input.q.toUpperCase();
      const phoneDigits = digitsOnly(input.q);

      const ors = [
        `billing_name.ilike.${term}`,
        `last_or_company.ilike.${term}`,
        `license_plates.cs.{${plateUpper}}`,
      ];
      if (phoneDigits.length >= 3) {
        ors.push(`phone_search.like.%${phoneDigits}%`);
      }

      query = query.or(ors.join(","));
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

    const plates = Array.from(
      new Set(
        input.license_plates
          .map((p) => p.trim().toUpperCase())
          .filter((p) => p.length > 0),
      ),
    );

    const payload = customerWritablePayload(input);

    // Item #25 — dedup on billing_name + any phone match before inserting.
    // If a candidate exists, return it instead of creating a duplicate row.
    // Match is case-insensitive on the name and digits-only on phones.
    const candidateName = (payload.billing_name ?? payload.last_or_company ?? "").trim();
    const phonesToMatch = [
      payload.contact_no,
      payload.phone_cell,
      payload.phone_home,
      payload.phone_business,
    ].filter((p): p is string => !!p && p.length === 10);

    if (candidateName && phonesToMatch.length > 0) {
      const { data: matches } = await supabase
        .from("customers")
        .select("*")
        .ilike("billing_name", candidateName)
        .eq("active", true);
      const hit = (matches as Customer[] | null ?? []).find((c) =>
        phonesToMatch.some(
          (p) =>
            p === c.contact_no ||
            p === c.phone_cell ||
            p === c.phone_home ||
            p === c.phone_business,
        ),
      );
      if (hit) {
        // Merge in any new license plates the caller passed.
        const merged = Array.from(new Set([...hit.license_plates, ...plates]));
        if (merged.length > hit.license_plates.length) {
          await supabase
            .from("customers")
            .update({ license_plates: merged, updated_by: profile.id })
            .eq("id", hit.id);
          hit.license_plates = merged;
        }
        revalidatePath("/customers");
        return hit;
      }
    }

    const { data, error } = await supabase
      .from("customers")
      .insert({
        ...payload,
        license_plates: plates,
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
  roles: ["owner", "manager", "staff"],
  handler: async (input, profile): Promise<Customer> => {
    const supabase = await createClient();
    const plates = Array.from(
      new Set(
        input.license_plates
          .map((p) => p.trim().toUpperCase())
          .filter((p) => p.length > 0),
      ),
    );

    const payload = customerWritablePayload(input);

    const { data, error } = await supabase
      .from("customers")
      .update({
        ...payload,
        license_plates: plates,
        updated_by: profile.id,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/customers");
    revalidatePath(`/customers/${input.id}`);
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

// Free-grease eligibility helper has moved to lib/utils/free-grease.ts so it
// can be imported by client components (this file is "use server").
// Re-export removed deliberately — import from "@/lib/utils/free-grease".
