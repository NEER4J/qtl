"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { InsufficientStockError, wrapAction } from "@/lib/actions/_utils";
import {
  findStockShortfalls,
  formatStockShortfalls,
  type StockConsumingLine,
} from "@/lib/actions/inventory";
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
  Profile,
  SalesJob,
  SalesJobItem,
  UnitOfMeasure,
} from "@/lib/db/types";

// Owner / co_owner / manager can consciously sell past a stock shortfall
// (mirrors private.can_edit_inventory() — the same roles who can correct
// stock directly). Accountant and staff cannot. `supervisor` is a manager
// clone at the app layer too (RLS aliases it, but role checks in JS see the
// literal stored value, so it must be listed explicitly — see 0074).
function canOverrideStock(profile: Profile): boolean {
  return (
    profile.role === "owner" ||
    profile.role === "co_owner" ||
    profile.role === "manager" ||
    profile.role === "supervisor"
  );
}

// Shared by createSalesJob / updateSalesJob — throws before anything is
// written if the sale would need more of a part/oil than is on hand, unless
// the caller is privileged AND explicitly asked to override.
async function assertStockAvailable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: Profile,
  locationId: string,
  newItems: StockConsumingLine[],
  oldItems: StockConsumingLine[],
  override: boolean,
): Promise<void> {
  const shortfalls = await findStockShortfalls(supabase, locationId, newItems, oldItems);
  if (shortfalls.length === 0) return;
  if (override && canOverrideStock(profile)) return;
  throw new InsufficientStockError(formatStockShortfalls(shortfalls));
}

// ----------------------------------------------------------------------------
// List — with filters + pagination + joined service type + location
// ----------------------------------------------------------------------------
export interface SalesJobRow extends SalesJob {
  location_code: string | null;
  service_type_code: string | null;
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
      "*, locations:location_id(code), service_types:service_type_id(code)",
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
  };

  const rows: SalesJobRow[] = (data as JoinedRow[] | null ?? []).map((r) => {
    const loc = Array.isArray(r.locations) ? r.locations[0] : r.locations;
    const svc = Array.isArray(r.service_types) ? r.service_types[0] : r.service_types;
    const { locations: _l, service_types: _s, invoice_pdf_path, ...rest } = r;
    void _l; void _s;
    return {
      ...(rest as SalesJob),
      location_code: loc?.code ?? null,
      service_type_code: svc?.code ?? null,
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
  location_address: string | null;
  location_phone: string | null;
  location_email: string | null;
  location_invoice_name: string | null;
  location_fax: string | null;
  location_hst_number: string | null;
  service_type_name: string | null;
  /** Display name of whoever last updated the job (updated_by). */
  updated_by_name: string | null;
  customer_license_plates: string[] | null;
  payments: SalesPaymentRow[];
  items: SalesJobItemRow[];
}

export interface SalesJobItemRow extends SalesJobItem {
  part_number: string | null;
  part_brand: string | null;
  /** Unit of measure from the part's category, for qty display ("3 ltr"). */
  unit_of_measure: UnitOfMeasure | null;
  /** Category id of the linked part — used for same-category dup detection on edit. */
  part_category_id: string | null;
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
        "*, locations:location_id(code, name, address, phone, email, invoice_name, fax, hst_number), service_types:service_type_id(code, name), customers:customer_id(license_plates)",
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
        "*, parts:part_id(part_number, brand, category_id, part_categories:category_id(unit_of_measure))",
      )
      .eq("sales_job_id", id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (jobErr) throw jobErr;
  if (payErr) throw payErr;
  if (itemsErr) throw itemsErr;
  if (!job) return null;

  type LocJoin = {
    code: string | null;
    name: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    invoice_name: string | null;
    fax: string | null;
    hst_number: string | null;
  };
  type JoinedRow = SalesJob & {
    locations: LocJoin | LocJoin[] | null;
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
      category_id: string | null;
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
        part_category_id: _p?.category_id ?? null,
      };
    },
  );

  // Resolve the last-editor's name (updated_by → auth.users, so PostgREST can't
  // embed profiles; do a small lookup). Falls back to null if not visible.
  let updatedByName: string | null = null;
  const editorId = (rest as SalesJob).updated_by;
  if (editorId) {
    const { data: editor } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", editorId)
      .maybeSingle();
    updatedByName = (editor as { full_name: string | null } | null)?.full_name ?? null;
  }

  return {
    ...(rest as SalesJob),
    location_code: loc?.code ?? null,
    location_name: loc?.name ?? null,
    location_address: loc?.address ?? null,
    location_phone: loc?.phone ?? null,
    location_email: loc?.email ?? null,
    location_invoice_name: loc?.invoice_name ?? null,
    location_fax: loc?.fax ?? null,
    location_hst_number: loc?.hst_number ?? null,
    service_type_name: svc?.name ?? null,
    customer_license_plates: cust?.license_plates ?? null,
    updated_by_name: updatedByName,
    payments: (payments ?? []) as SalesPaymentRow[],
    items,
  };
}

// ----------------------------------------------------------------------------
// Create
// ----------------------------------------------------------------------------
export const createSalesJob = wrapAction({
  schema: SalesJobInput,
  roles: ["owner", "co_owner", "manager", "staff"],
  handler: async (input, profile): Promise<SalesJob> => {
    // Staff MUST write to their own location. Enforce server-side even though
    // RLS also blocks cross-location writes.
    const locationId =
      profile.role === "staff"
        ? profile.location_id ?? input.location_id
        : input.location_id;

    const supabase = await createClient();

    // Block the sale before anything is written if it needs more of a part or
    // oil grade than this location has on hand (client 2026-07-23). No old
    // items to net against on create — every consuming line is a fresh draw.
    await assertStockAvailable(
      supabase,
      profile,
      locationId,
      input.items ?? [],
      [],
      input.override_stock_check,
    );

    // Reconcile single-shot vs multi-payment input. When the form sends an
    // initial_payments array, that's the source of truth; we derive
    // paid_amount + (legacy) payment_mode from it. The legacy fields stay on
    // the job row for analytics/reports and for backwards compat with code
    // that only reads sales_jobs.payment_mode.
    const initialPayments = input.initial_payments ?? [];
    const usingMulti = initialPayments.length > 0;
    const effectivePaidAmount = usingMulti
      ? Math.round(initialPayments.reduce((a, p) => a + p.amount, 0) * 100) / 100
      : input.paid_amount;
    const effectivePaymentMode = usingMulti
      ? initialPayments[0]!.mode
      : input.payment_mode ?? null;
    const status = deriveStatus(input.total, effectivePaidAmount);

    const { data, error } = await supabase
      .from("sales_jobs")
      .insert({
        location_id: locationId,
        job_date: input.job_date,
        start_time: input.start_time,
        end_time: input.end_time,
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
        paid_amount: effectivePaidAmount,
        payment_mode: effectivePaymentMode,
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

    // Persist payments to the ledger. Multi-row path inserts each entry;
    // single-shot path mirrors the legacy paid_amount/payment_mode as one row
    // so the ledger stays consistent across both UI shapes.
    if (usingMulti) {
      const rows = initialPayments.map((p) => ({
        sales_job_id: data.id,
        paid_on: input.job_date,
        amount: p.amount,
        mode: p.mode,
        created_by: profile.id,
      }));
      const { error: payErr } = await supabase.from("sales_payments").insert(rows);
      if (payErr) throw payErr;
    } else if (input.paid_amount > 0 && input.payment_mode) {
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

    // Free-grease "one-shot" rule: once a customer redeems the offer on a job,
    // clear free_grease_until so the next sales-form lookup treats them as
    // ineligible. The 30-day window is enforced separately via
    // isFreeGreaseEligible(); this just retires the offer after one use.
    if (input.free_grease_applied && input.customer_id) {
      const { error: clearErr } = await supabase
        .from("customers")
        .update({ free_grease_until: null, updated_by: profile.id })
        .eq("id", input.customer_id);
      if (clearErr) {
        // Don't fail the whole save — the job is on the books either way.
        // Log so the issue surfaces on the next dashboard render.
        console.error("[free-grease-clear]", clearErr);
      }
    }

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
  roles: ["owner", "co_owner", "manager", "staff"],
  handler: async (input, profile): Promise<SalesJob> => {
    const supabase = await createClient();

    // Don't blank out an existing invoice_no — skip the column if the user
    // cleared it. For a fresh value (insert path) the BEFORE INSERT trigger
    // fills the blank; on update we preserve the stored value instead.
    const invoiceNoUpdate = input.invoice_no?.trim()
      ? { invoice_no: input.invoice_no.trim() }
      : {};

    // Re-settle the payment status from the (possibly edited) total. Editing a
    // job down to a free-grease-only $0 job must flip it to 'paid', not leave a
    // stale 'outstanding'. The job-level update doesn't touch the payment
    // ledger, so read the current paid amount to derive against (the payments
    // rollup trigger only fires on payment changes, not on job edits).
    const { data: existing, error: existingErr } = await supabase
      .from("sales_jobs")
      .select("paid_amount, created_at, location_id")
      .eq("id", input.id)
      .single();
    if (existingErr) throw existingErr;

    // Block the edit before anything is written if it needs more of a part or
    // oil grade than this location has on hand. Net against the job's CURRENT
    // items first — otherwise re-saving an unchanged job would look like it
    // needs its own already-reserved stock all over again. If the job is
    // being moved to a different location, the old items were reserved
    // against the OLD location's stock, not this one, so there's nothing to
    // net there — treat it as a fresh draw on the new location.
    const sameLocation = existing?.location_id === input.location_id;
    const { data: oldItemRows, error: oldItemsErr } = await supabase
      .from("sales_job_items")
      .select("part_id, oil_type_id, quantity, unit_price, is_customer_supplied")
      .eq("sales_job_id", input.id);
    if (oldItemsErr) throw oldItemsErr;
    await assertStockAvailable(
      supabase,
      profile,
      input.location_id,
      input.items ?? [],
      sameLocation ? ((oldItemRows ?? []) as StockConsumingLine[]) : [],
      input.override_stock_check,
    );

    // Staff (and technician) may only edit a job on the SAME calendar day it was
    // created (Toronto time). Owner / co_owner / manager / accountant are
    // unrestricted.
    if (profile.role === "staff" || profile.role === "technician") {
      const dayOf = (iso: string) =>
        new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Toronto",
      });
      if (existing?.created_at && dayOf(existing.created_at) !== today) {
        throw new Error("You can only edit a job on the day it was created.");
      }
    }

    const status = deriveStatus(input.total, existing?.paid_amount ?? 0);

    const { data, error } = await supabase
      .from("sales_jobs")
      .update({
        location_id: input.location_id,
        job_date: input.job_date,
        start_time: input.start_time,
        end_time: input.end_time,
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
        payment_status: status,
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

    // Free-grease "one-shot" rule on edit too: if the job is toggled into
    // free-grease-applied during an edit, retire the offer on the customer.
    if (input.free_grease_applied && input.customer_id) {
      const { error: clearErr } = await supabase
        .from("customers")
        .update({ free_grease_until: null, updated_by: profile.id })
        .eq("id", input.customer_id);
      if (clearErr) {
        console.error("[free-grease-clear]", clearErr);
      }
    }

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
  roles: ["owner", "co_owner", "manager", "staff", "accountant"],
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
  roles: ["owner", "co_owner"],
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
        mhsw_unit?: number;
        is_taxable?: boolean;
        package_label?: string | null;
        package_group?: string | null;
        oil_type_id?: string | null;
        transmission_service_id?: string | null;
        merged_unit_price?: number | null;
        is_customer_supplied?: boolean;
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
    mhsw_unit: it.mhsw_unit ?? 0,
    is_taxable: it.is_taxable ?? true,
    package_label: it.package_label ?? null,
    package_group: it.package_group ?? null,
    oil_type_id: it.oil_type_id ?? null,
    transmission_service_id: it.transmission_service_id ?? null,
    merged_unit_price: it.merged_unit_price ?? null,
    is_customer_supplied: it.is_customer_supplied ?? false,
    position: idx,
    created_by: userId,
  }));
  const { error: insErr } = await supabase.from("sales_job_items").insert(rows);
  if (insErr) throw insErr;
}

function deriveStatus(total: number, paid: number): PaymentStatus {
  // Nothing owed (e.g. a free-grease-only $0 job) is settled, not outstanding.
  if (total <= 0.005) return "paid";
  if (paid <= 0) return "outstanding";
  if (paid < total) return "partial";
  return "paid";
}
