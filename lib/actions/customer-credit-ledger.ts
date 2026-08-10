// Customer store-credit ledger helpers — NOT a "use server" file. Server
// Actions files may only export async functions; these are internal helpers
// imported by sales.ts (same pattern as stock-shortfalls.ts).
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Sum of ledger rows for a customer = available store credit. */
export async function getCustomerCreditBalance(
  supabase: Supabase,
  customerId: string,
  /** When re-syncing a job on edit, ignore its existing ledger rows first. */
  excludeJobId?: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("customer_credit_ledger")
    .select("amount, sales_job_id")
    .eq("customer_id", customerId);
  if (error) throw error;

  const total = (data ?? []).reduce((sum, row) => {
    if (excludeJobId && row.sales_job_id === excludeJobId) return sum;
    return sum + Number(row.amount);
  }, 0);
  return Math.round(total * 100) / 100;
}

/**
 * Replace this job's ledger rows with the current credit issue / apply amounts,
 * including any overpayment credit (payments tendered beyond the amount due —
 * see migration 0127). Called after the sales_jobs row AND its sales_payments
 * are written, since the overpayment is derived from the payments ledger.
 */
export async function syncJobCreditLedger(
  supabase: Supabase,
  jobId: string,
  customerId: string | null | undefined,
  total: number,
  creditApplied: number,
  invoiceNo: string,
  userId: string,
): Promise<void> {
  if (!customerId) return;

  // Overpayment = tendered payments minus what the invoice could absorb.
  // Derived from sales_payments (the source of truth for tender) so the same
  // sync works for create, edit, and later add-payment calls.
  let overpaid = 0;
  if (total > 0.005) {
    const { data: payRows, error: payErr } = await supabase
      .from("sales_payments")
      .select("amount")
      .eq("sales_job_id", jobId);
    if (payErr) throw payErr;
    const tendered = (payRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const due = Math.max(0, total - creditApplied);
    overpaid = Math.max(0, Math.round((tendered - due) * 100) / 100);
  }

  const { error: delErr } = await supabase
    .from("customer_credit_ledger")
    .delete()
    .eq("sales_job_id", jobId);
  if (delErr) throw delErr;

  const rows: Array<{
    customer_id: string;
    sales_job_id: string;
    amount: number;
    notes: string;
    created_by: string;
  }> = [];

  if (total < -0.005) {
    rows.push({
      customer_id: customerId,
      sales_job_id: jobId,
      amount: Math.round(Math.abs(total) * 100) / 100,
      notes: `Store credit issued — invoice ${invoiceNo}`,
      created_by: userId,
    });
  }

  if (creditApplied > 0.005) {
    rows.push({
      customer_id: customerId,
      sales_job_id: jobId,
      amount: -Math.round(creditApplied * 100) / 100,
      notes: `Store credit applied — invoice ${invoiceNo}`,
      created_by: userId,
    });
  }

  if (overpaid > 0.005) {
    rows.push({
      customer_id: customerId,
      sales_job_id: jobId,
      amount: overpaid,
      notes: `Overpayment credit — invoice ${invoiceNo}`,
      created_by: userId,
    });
  }

  if (rows.length === 0) return;

  const { error: insErr } = await supabase.from("customer_credit_ledger").insert(rows);
  if (insErr) throw insErr;
}

/** Reverse every ledger movement tied to a deactivated job. */
export async function reverseJobCreditLedger(
  supabase: Supabase,
  jobId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("customer_credit_ledger")
    .select("customer_id, amount")
    .eq("sales_job_id", jobId);
  if (error) throw error;
  if (!data || data.length === 0) return;

  const reversals = data.map((row) => ({
    customer_id: row.customer_id as string,
    sales_job_id: jobId,
    amount: -Number(row.amount),
    notes: "Reversed — invoice deactivated",
    created_by: userId,
  }));

  const { error: insErr } = await supabase
    .from("customer_credit_ledger")
    .insert(reversals);
  if (insErr) throw insErr;
}

export async function assertCreditAppliedValid(
  supabase: Supabase,
  customerId: string | null | undefined,
  total: number,
  creditApplied: number,
  excludeJobId?: string,
): Promise<void> {
  if (creditApplied <= 0.005) return;
  if (!customerId) {
    throw new Error("Select a customer before applying store credit.");
  }
  if (total <= 0.005) {
    throw new Error("Store credit cannot be applied when the invoice total is zero or negative.");
  }
  if (creditApplied > total + 0.01) {
    throw new Error("Store credit applied cannot exceed the invoice total.");
  }
  const balance = await getCustomerCreditBalance(supabase, customerId, excludeJobId);
  if (creditApplied > balance + 0.01) {
    throw new Error(
      `Not enough store credit — available ${balance.toFixed(2)}, tried to apply ${creditApplied.toFixed(2)}.`,
    );
  }
}

/** Net-credit invoices must be tied to a customer so the ledger can be updated. */
export function assertNetCreditCustomer(
  customerId: string | null | undefined,
  total: number,
): void {
  if (total >= -0.005) return;
  if (!customerId) {
    throw new Error("Select a customer — store credit cannot be issued without one.");
  }
}

/** credited_from_job_id must belong to the same customer (when set). */
export async function assertCreditedFromJobValid(
  supabase: Supabase,
  customerId: string | null | undefined,
  creditedFromJobId: string | null | undefined,
  currentJobId?: string,
): Promise<void> {
  if (!creditedFromJobId) return;
  if (!customerId) {
    throw new Error("Select a customer before linking a prior invoice.");
  }
  if (currentJobId && creditedFromJobId === currentJobId) {
    throw new Error("A job cannot credit against itself.");
  }
  const { data, error } = await supabase
    .from("sales_jobs")
    .select("customer_id")
    .eq("id", creditedFromJobId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("The linked prior invoice was not found.");
  }
  if (data.customer_id !== customerId) {
    throw new Error("The linked prior invoice belongs to a different customer.");
  }
}
