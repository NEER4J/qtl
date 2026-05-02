"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  AddSalesPaymentInput,
  DeactivateSalesJobInput,
  ListSalesJobsInput,
  SalesJobInput,
  UpdateSalesJobInput,
} from "@/lib/schemas/sales";
import type {
  PaymentMode,
  PaymentStatus,
  SalesJob,
  SalesJobItem,
  UnitOfMeasure,
} from "@/lib/db/types";

// ----------------------------------------------------------------------------
// List — with filters + pagination + joined service type + location
// ----------------------------------------------------------------------------
export interface SalesJobRow extends SalesJob {
  location_code: string | null;
  service_type_code: string | null;
  customer_status: string | null;
  invoice_pdf_path: string | null;
}

export interface ListSalesJobsResult {
  rows: SalesJobRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listSalesJobs(
  raw: Partial<Record<string, string | number>> = {},
): Promise<ListSalesJobsResult> {
  const input = ListSalesJobsInput.parse(raw);
  const supabase = await createClient();

  const from = (input.page - 1) * input.pageSize;
  const to = from + input.pageSize - 1;

  let query = supabase
    .from("sales_jobs")
    .select(
      "*, locations:location_id(code), service_types:service_type_id(code), customers:customer_id(status)",
      { count: "exact" },
    )
    .is("deactivated_at", null)
    .order("job_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (input.from) query = query.gte("job_date", input.from);
  if (input.to) query = query.lte("job_date", input.to);
  if (input.location_id) query = query.eq("location_id", input.location_id);
  if (input.service_type_id) query = query.eq("service_type_id", input.service_type_id);
  if (input.payment_status) query = query.eq("payment_status", input.payment_status);
  if (input.customer_status) query = query.eq("customers.status", input.customer_status);
  if (input.q) {
    const term = `%${input.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    query = query.or(
      `invoice_no.ilike.${term},billing_name.ilike.${term},license_plate.ilike.${term}`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;

  type JoinedRow = SalesJob & {
    invoice_pdf_path?: string | null;
    locations: { code: string | null } | { code: string | null }[] | null;
    service_types: { code: string | null } | { code: string | null }[] | null;
    customers: { status: string | null } | { status: string | null }[] | null;
  };

  const rows: SalesJobRow[] = (data as JoinedRow[] | null ?? []).map((r) => {
    const loc = Array.isArray(r.locations) ? r.locations[0] : r.locations;
    const svc = Array.isArray(r.service_types) ? r.service_types[0] : r.service_types;
    const cus = Array.isArray(r.customers) ? r.customers[0] : r.customers;
    const { locations: _l, service_types: _s, customers: _c, invoice_pdf_path, ...rest } = r;
    void _l; void _s; void _c;
    return {
      ...(rest as SalesJob),
      location_code: loc?.code ?? null,
      service_type_code: svc?.code ?? null,
      customer_status: cus?.status ?? null,
      invoice_pdf_path: invoice_pdf_path ?? null,
    };
  });

  return { rows, total: count ?? 0, page: input.page, pageSize: input.pageSize };
}

// ----------------------------------------------------------------------------
// Get one
// ----------------------------------------------------------------------------
export interface SalesJobDetail extends SalesJob {
  location_name: string | null;
  location_code: string | null;
  service_type_name: string | null;
  customer_license_plates: string[] | null;
  payments: SalesPaymentRow[];
  items: SalesJobItemRow[];
}

export interface SalesJobItemRow extends SalesJobItem {
  part_number: string | null;
  part_brand: string | null;
  /** Unit of measure from the part's category, for qty display ("3 ltr"). */
  unit_of_measure: UnitOfMeasure | null;
}

export interface SalesPaymentRow {
  id: string;
  paid_on: string;
  amount: number;
  mode: PaymentMode;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export async function getSalesJob(id: string): Promise<SalesJobDetail | null> {
  const supabase = await createClient();
  const [
    { data: job, error: jobErr },
    { data: payments, error: payErr },
    { data: itemsData, error: itemsErr },
  ] = await Promise.all([
    supabase
      .from("sales_jobs")
      .select(
        "*, locations:location_id(code, name), service_types:service_type_id(code, name), customers:customer_id(license_plates)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sales_payments")
      .select("*")
      .eq("sales_job_id", id)
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("sales_job_items")
      .select(
        "*, parts:part_id(part_number, brand, part_categories:category_id(unit_of_measure))",
      )
      .eq("sales_job_id", id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (jobErr) throw jobErr;
  if (payErr) throw payErr;
  if (itemsErr) throw itemsErr;
  if (!job) return null;

  type JoinedRow = SalesJob & {
    locations: { code: string | null; name: string | null } | { code: string | null; name: string | null }[] | null;
    service_types: { code: string | null; name: string | null } | { code: string | null; name: string | null }[] | null;
    customers: { license_plates: string[] | null } | { license_plates: string[] | null }[] | null;
  };
  const j = job as JoinedRow;
  const loc = Array.isArray(j.locations) ? j.locations[0] : j.locations;
  const svc = Array.isArray(j.service_types) ? j.service_types[0] : j.service_types;
  const cust = Array.isArray(j.customers) ? j.customers[0] : j.customers;
  const { locations: _l, service_types: _s, customers: _c, ...rest } = j;
  void _l; void _s; void _c;

  type ItemJoined = SalesJobItem & {
    parts: {
      part_number: string | null;
      brand: string | null;
      part_categories: { unit_of_measure: UnitOfMeasure } | null;
    } | null;
  };
  const items: SalesJobItemRow[] = ((itemsData ?? []) as unknown as ItemJoined[]).map(
    (it) => {
      const { parts: _p, ...rest } = it;
      return {
        ...(rest as SalesJobItem),
        part_number: _p?.part_number ?? null,
        part_brand: _p?.brand ?? null,
        unit_of_measure: _p?.part_categories?.unit_of_measure ?? null,
      };
    },
  );

  return {
    ...(rest as SalesJob),
    location_code: loc?.code ?? null,
    location_name: loc?.name ?? null,
    service_type_name: svc?.name ?? null,
    customer_license_plates: cust?.license_plates ?? null,
    payments: (payments ?? []) as SalesPaymentRow[],
    items,
  };
}

// ----------------------------------------------------------------------------
// Create
// ----------------------------------------------------------------------------
export const createSalesJob = wrapAction({
  schema: SalesJobInput,
  roles: ["owner", "manager", "staff"],
  handler: async (input, profile): Promise<SalesJob> => {
    // Staff MUST write to their own location. Enforce server-side even though
    // RLS also blocks cross-location writes.
    const locationId =
      profile.role === "staff"
        ? profile.location_id ?? input.location_id
        : input.location_id;

    const supabase = await createClient();
    const status = deriveStatus(input.total, input.paid_amount);

    const { data, error } = await supabase
      .from("sales_jobs")
      .insert({
        location_id: locationId,
        job_date: input.job_date,
        job_time: input.job_time,
        bay_no: input.bay_no ?? null,
        upper_tech: input.upper_tech || null,
        lower_tech: input.lower_tech || null,
        invoice_no: input.invoice_no?.trim() || null,
        customer_id: input.customer_id ?? null,
        vehicle_id: input.vehicle_id ?? null,
        billing_name: input.billing_name,
        billing_address: input.billing_address || null,
        business_phone: input.business_phone || null,
        alt_phone: input.alt_phone || null,
        customer_order_no: input.customer_order_no || null,
        unit_no: input.unit_no || null,
        vehicle_year: input.vehicle_year ?? null,
        vehicle_make: input.vehicle_make || null,
        vehicle_model: input.vehicle_model || null,
        vin: input.vin || null,
        engine_size: input.engine_size || null,
        license_plate: input.license_plate || null,
        contact_no: input.contact_no || null,
        email: input.email || null,
        odometer: input.odometer ?? null,
        service_type_id: input.service_type_id,
        advisor_name: input.advisor_name || null,
        comments: input.comments || null,
        sub_total: input.sub_total,
        hst: input.hst,
        total: input.total,
        paid_amount: input.paid_amount,
        payment_mode: input.payment_mode ?? null,
        payment_status: status,
        free_grease_applied: input.free_grease_applied,
        free_grease_override_reason: input.free_grease_override_reason || null,
        engine_type_id: input.engine_type_id ?? null,
        oil_type_id: input.oil_type_id ?? null,
        oil_container: input.oil_container ?? null,
        auto_priced_at: input.auto_priced_at ?? null,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("*")
      .single();
    if (error) throw error;

    // Mirror the single-shot paid amount as a payment row so the ledger is
    // consistent with what the spec calls "Partial Payments" UX (Add Payment
    // button accumulates more rows). A zero-amount shortcut stays a zero-row
    // job.
    if (input.paid_amount > 0 && input.payment_mode) {
      const { error: payErr } = await supabase.from("sales_payments").insert({
        sales_job_id: data.id,
        paid_on: input.job_date,
        amount: input.paid_amount,
        mode: input.payment_mode,
        created_by: profile.id,
      });
      if (payErr) throw payErr;
    }

    await replaceJobItems(supabase, data.id, input.items, profile.id);

    revalidatePath("/sales");
    revalidatePath("/dashboard");
    return data as SalesJob;
  },
});

// ----------------------------------------------------------------------------
// Update
// ----------------------------------------------------------------------------
export const updateSalesJob = wrapAction({
  schema: UpdateSalesJobInput,
  roles: ["owner", "manager"],
  handler: async (input, profile): Promise<SalesJob> => {
    const supabase = await createClient();

    // Don't blank out an existing invoice_no — skip the column if the user
    // cleared it. For a fresh value (insert path) the BEFORE INSERT trigger
    // fills the blank; on update we preserve the stored value instead.
    const invoiceNoUpdate = input.invoice_no?.trim()
      ? { invoice_no: input.invoice_no.trim() }
      : {};

    const { data, error } = await supabase
      .from("sales_jobs")
      .update({
        location_id: input.location_id,
        job_date: input.job_date,
        job_time: input.job_time,
        bay_no: input.bay_no ?? null,
        upper_tech: input.upper_tech || null,
        lower_tech: input.lower_tech || null,
        ...invoiceNoUpdate,
        customer_id: input.customer_id ?? null,
        vehicle_id: input.vehicle_id ?? null,
        billing_name: input.billing_name,
        billing_address: input.billing_address || null,
        business_phone: input.business_phone || null,
        alt_phone: input.alt_phone || null,
        customer_order_no: input.customer_order_no || null,
        unit_no: input.unit_no || null,
        vehicle_year: input.vehicle_year ?? null,
        vehicle_make: input.vehicle_make || null,
        vehicle_model: input.vehicle_model || null,
        vin: input.vin || null,
        engine_size: input.engine_size || null,
        license_plate: input.license_plate || null,
        contact_no: input.contact_no || null,
        email: input.email || null,
        odometer: input.odometer ?? null,
        service_type_id: input.service_type_id,
        advisor_name: input.advisor_name || null,
        comments: input.comments || null,
        sub_total: input.sub_total,
        hst: input.hst,
        total: input.total,
        payment_mode: input.payment_mode ?? null,
        free_grease_applied: input.free_grease_applied,
        free_grease_override_reason: input.free_grease_override_reason || null,
        engine_type_id: input.engine_type_id ?? null,
        oil_type_id: input.oil_type_id ?? null,
        oil_container: input.oil_container ?? null,
        auto_priced_at: input.auto_priced_at ?? null,
        updated_by: profile.id,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;

    await replaceJobItems(supabase, input.id, input.items, profile.id);

    revalidatePath("/sales");
    revalidatePath(`/sales/${input.id}`);
    revalidatePath("/dashboard");
    return data as SalesJob;
  },
});

// ----------------------------------------------------------------------------
// Add partial payment
// ----------------------------------------------------------------------------
export const addSalesPayment = wrapAction({
  schema: AddSalesPaymentInput,
  roles: ["owner", "manager", "staff", "accountant"],
  handler: async (input, profile): Promise<SalesPaymentRow> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sales_payments")
      .insert({
        sales_job_id: input.sales_job_id,
        paid_on: input.paid_on,
        amount: input.amount,
        mode: input.mode,
        transaction_id: input.transaction_id || null,
        notes: input.notes || null,
        created_by: profile.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(`/sales/${input.sales_job_id}`);
    revalidatePath("/sales");
    revalidatePath("/dashboard");
    return data as SalesPaymentRow;
  },
});

// ----------------------------------------------------------------------------
// Deactivate (owner only — also enforced by trigger)
// ----------------------------------------------------------------------------
export const deactivateSalesJob = wrapAction({
  schema: DeactivateSalesJobInput,
  roles: ["owner"],
  handler: async (input, profile): Promise<{ id: string }> => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("sales_jobs")
      .update({
        deactivated_at: new Date().toISOString(),
        deactivated_by: profile.id,
        updated_by: profile.id,
      })
      .eq("id", input.id);
    if (error) throw error;
    revalidatePath("/sales");
    return { id: input.id };
  },
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
async function replaceJobItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  salesJobId: string,
  items:
    | {
        id?: string;
        part_id?: string | null;
        description: string;
        quantity: number;
        unit_price: number;
        is_taxable?: boolean;
        package_label?: string | null;
      }[]
    | undefined,
  userId: string,
): Promise<void> {
  // Replace-all strategy: delete existing rows, insert the new set. Audit log
  // preserves the prior version. The job has very few line items (typically
  // <10) so the row churn is trivial.
  const { error: delErr } = await supabase
    .from("sales_job_items")
    .delete()
    .eq("sales_job_id", salesJobId);
  if (delErr) throw delErr;

  if (!items || items.length === 0) return;

  const rows = items.map((it, idx) => ({
    sales_job_id: salesJobId,
    part_id: it.part_id ?? null,
    description: it.description.trim(),
    quantity: it.quantity,
    unit_price: it.unit_price,
    is_taxable: it.is_taxable ?? true,
    package_label: it.package_label ?? null,
    position: idx,
    created_by: userId,
  }));
  const { error: insErr } = await supabase.from("sales_job_items").insert(rows);
  if (insErr) throw insErr;
}

function deriveStatus(total: number, paid: number): PaymentStatus {
  if (paid <= 0) return "outstanding";
  if (paid < total) return "partial";
  return "paid";
}
