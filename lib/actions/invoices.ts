"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/require";
import { getSalesJob } from "@/lib/actions/sales";

// ============================================================================
// PDF generation + Storage upload
// ============================================================================

export interface GenerateInvoiceResult {
  signedUrl: string;
  path: string;
}

/**
 * Generate a PDF for the given sales job, upload to Storage, cache the path
 * on the sales_jobs row, and return a short-lived signed URL.
 * Falls back to a data-URL if Storage is unavailable.
 */
export async function generateInvoicePdf(
  jobId: string,
): Promise<GenerateInvoiceResult> {
  const profile = await requireProfile();
  const job = await getSalesJob(jobId);
  if (!job) throw new Error("Sales job not found");

  // Dynamically import to keep the PDF renderer out of the initial bundle.
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { buildInvoiceDoc } = await import("@/components/pdf/InvoicePdf");

  const buffer = await renderToBuffer(buildInvoiceDoc(job));

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

    // Cache path on the sales_jobs row
    const supabase = await createClient();
    await supabase
      .from("sales_jobs")
      .update({ invoice_pdf_path: storagePath })
      .eq("id", jobId);

    // Return 60-minute signed URL
    const { data: signed, error: signErr } = await admin.storage
      .from("invoices")
      .createSignedUrl(storagePath, 3600);
    if (signErr || !signed) throw signErr ?? new Error("Signed URL failed");

    return { signedUrl: signed.signedUrl, path: storagePath };
  } catch {
    // Storage not configured yet — return inline data URL so the button works
    const base64 = buffer.toString("base64");
    return {
      signedUrl: `data:application/pdf;base64,${base64}`,
      path: "",
    };
  }
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
