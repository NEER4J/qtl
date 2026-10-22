"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/require";
import { getSalesJob } from "@/lib/actions/sales";
import { getAppSettings } from "@/lib/actions/reference";

// ============================================================================
// PDF generation + Storage upload
// ============================================================================

export interface GenerateInvoiceResult {
  signedUrl: string;
  path: string;
}

/** Render the job's invoice and store it in the invoices bucket. */
async function renderAndStore(jobId: string): Promise<{ buffer: Buffer; storagePath: string }> {
  const job = await getSalesJob(jobId);
  if (!job) throw new Error("Sales job not found");

  const settings = await getAppSettings();

  // Dynamically import to keep the PDF renderer out of the initial bundle.
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { buildInvoiceDoc } = await import("@/components/pdf/InvoicePdf");

  const buffer = await renderToBuffer(
    buildInvoiceDoc(job, { hstRate: Number(settings.hst_rate) }),
  );

  const storagePath = `${job.location_code}/${job.invoice_no.replace(/[^A-Za-z0-9-_]/g, "_")}.pdf`;
  try {
    const admin = createAdminClient();
    const { error: uploadErr } = await admin.storage
      .from("invoices")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) throw uploadErr;
  } catch (err) {
    // Storage unavailable: the PDF rides on the error for the data-URL fallback.
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), { buffer });
  }

  // Cache path on the sales_jobs row
  const supabase = await createClient();
  await supabase
    .from("sales_jobs")
    .update({ invoice_pdf_path: storagePath })
    .eq("id", jobId);

  return { buffer, storagePath };
}

/**
 * Generate a PDF for the given sales job, upload to Storage, cache the path
 * on the sales_jobs row, and return a short-lived signed URL.
 * Falls back to a data-URL if Storage is unavailable.
 */
export async function generateInvoicePdf(
  jobId: string,
): Promise<GenerateInvoiceResult> {
  await requireProfile();
  try {
    const { storagePath } = await renderAndStore(jobId);
    // Return 60-minute signed URL
    const admin = createAdminClient();
    const { data: signed, error: signErr } = await admin.storage
      .from("invoices")
      .createSignedUrl(storagePath, 3600);
    if (signErr || !signed) throw signErr ?? new Error("Signed URL failed");

    return { signedUrl: signed.signedUrl, path: storagePath };
  } catch (err) {
    // Storage not configured yet — return inline data URL so the button works
    const buffer = (err as { buffer?: Buffer }).buffer;
    if (!buffer) throw err;
    return {
      signedUrl: `data:application/pdf;base64,${buffer.toString("base64")}`,
      path: "",
    };
  }
}

/** Days an emailed invoice link stays open. */
const SHARE_LINK_DAYS = 30;

/**
 * A link to put in an invoice email (client 2026-10-20 — Email button, any
 * address). The customer isn't signed in to QTL, so it is the stored PDF,
 * signed for 30 days, rendered fresh so it matches the invoice as it is now.
 */
export async function getInvoiceShareLink(
  jobId: string,
): Promise<{ url: string; days: number }> {
  await requireProfile();
  const { storagePath } = await renderAndStore(jobId);
  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from("invoices")
    .createSignedUrl(storagePath, SHARE_LINK_DAYS * 24 * 60 * 60);
  if (error || !signed) throw error ?? new Error("Couldn't make a link to the invoice.");
  return { url: signed.signedUrl, days: SHARE_LINK_DAYS };
}

/**
 * Return a fresh signed URL for an already-uploaded PDF.
 * If path is missing, triggers a regeneration.
 */
export async function getInvoiceUrl(jobId: string): Promise<string | null> {
  const profile = await requireProfile();
  void profile;

  const supabase = await createClient();
  const { data } = await supabase
    .from("sales_jobs")
    .select("invoice_pdf_path")
    .eq("id", jobId)
    .single();

  const path = (data as { invoice_pdf_path?: string | null })?.invoice_pdf_path;
  if (!path) return null;

  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from("invoices")
    .createSignedUrl(path, 3600);
  return signed?.signedUrl ?? null;
}
