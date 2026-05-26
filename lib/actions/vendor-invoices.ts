"use server";

import { revalidatePath } from "next/cache";

import { wrapAction } from "@/lib/actions/_utils";
import { createClient } from "@/lib/supabase/server";
import {
  CreateVendorInvoiceInput,
  RecordVendorInvoicePaymentInput,
} from "@/lib/schemas/vendor-invoices";
import type { PaymentStatus, VendorInvoice, VendorInvoiceItem } from "@/lib/db/types";

function deriveStatus(total: number, paid: number): PaymentStatus {
  if (paid <= 0) return "outstanding";
  if (paid >= total) return "paid";
  return "partial";
}

export async function listVendorInvoicesForVendor(
  vendorId: string,
): Promise<VendorInvoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendor_invoices")
    .select("*")
    .eq("vendor_id", vendorId)
    .is("deactivated_at", null)
    .order("invoice_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VendorInvoice[];
}

export async function getVendorInvoice(id: string): Promise<{
  invoice: VendorInvoice;
  items: VendorInvoiceItem[];
} | null> {
  const supabase = await createClient();
  const [invRes, itemsRes] = await Promise.all([
    supabase.from("vendor_invoices").select("*").eq("id", id).maybeSingle(),
    supabase.from("vendor_invoice_items").select("*").eq("invoice_id", id).order("position"),
  ]);
  if (invRes.error) throw invRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (!invRes.data) return null;
  return {
    invoice: invRes.data as VendorInvoice,
    items: (itemsRes.data ?? []) as VendorInvoiceItem[],
  };
}

export const createVendorInvoice = wrapAction({
  schema: CreateVendorInvoiceInput,
  roles: ["owner", "co_owner", "manager", "accountant"],
  handler: async (input, profile): Promise<VendorInvoice> => {
    const supabase = await createClient();
    const total = Number(input.sub_total) + Number(input.hst);
    const status = deriveStatus(total, Number(input.paid_amount));

    const { data: inv, error } = await supabase
      .from("vendor_invoices")
      .insert({
        vendor_id: input.vendor_id,
        location_id: input.location_id,
        invoice_no: input.invoice_no,
        invoice_date: input.invoice_date,
        sub_total: input.sub_total,
        hst: input.hst,
        paid_amount: input.paid_amount,
        payment_status: status,
        notes: input.notes,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("*")
      .single();
    if (error) throw error;

    if (input.items.length > 0) {
      const rows = input.items.map((it, i) => ({
        invoice_id: (inv as VendorInvoice).id,
        vendor_part_id: it.vendor_part_id ?? null,
        description: it.description,
        quantity: it.quantity,
        unit_cost: it.unit_cost,
        position: i,
      }));
      const { error: itemsErr } = await supabase
        .from("vendor_invoice_items")
        .insert(rows);
      if (itemsErr) throw itemsErr;
    }

    revalidatePath(`/vendors/${input.vendor_id}`);
    return inv as VendorInvoice;
  },
});

export const recordVendorInvoicePayment = wrapAction({
  schema: RecordVendorInvoicePaymentInput,
  roles: ["owner", "co_owner", "manager", "accountant"],
  handler: async (input, profile): Promise<VendorInvoice> => {
    const supabase = await createClient();
    // Read current paid_amount + total to compute new status.
    const { data: existing, error: readErr } = await supabase
      .from("vendor_invoices")
      .select("paid_amount, total, vendor_id")
      .eq("id", input.id)
      .single();
    if (readErr) throw readErr;
    const newPaid = Number(existing.paid_amount) + Number(input.amount);
    const status = deriveStatus(Number(existing.total), newPaid);

    const { data, error } = await supabase
      .from("vendor_invoices")
      .update({
        paid_amount: newPaid,
        payment_status: status,
        updated_by: profile.id,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(`/vendors/${(existing as { vendor_id: string }).vendor_id}`);
    return data as VendorInvoice;
  },
});
