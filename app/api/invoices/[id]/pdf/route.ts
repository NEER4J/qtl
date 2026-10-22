import { requireProfile } from "@/lib/auth/require";
import { getAppSettings } from "@/lib/actions/reference";
import { getSalesJob } from "@/lib/actions/sales";

export const dynamic = "force-dynamic";

/**
 * The invoice PDF, rendered on request. A plain GET a link or an iframe can
 * open straight away — the old button made the PDF first and opened it after,
 * which the browser blocked as a pop-up. `?download=1` saves it instead of
 * showing it.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const job = await getSalesJob(id);
  if (!job) return new Response("Invoice not found", { status: 404 });

  const settings = await getAppSettings();
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { buildInvoiceDoc } = await import("@/components/pdf/InvoicePdf");
  const buffer = await renderToBuffer(buildInvoiceDoc(job, { hstRate: Number(settings.hst_rate) }));

  const download = new URL(req.url).searchParams.get("download") === "1";
  const filename = `invoice-${job.invoice_no.replace(/[^A-Za-z0-9-_]/g, "_")}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
