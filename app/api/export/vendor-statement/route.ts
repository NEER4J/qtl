import { getVendorStatement } from "@/lib/actions/reports";
import { csvResponse, toCsv } from "@/lib/utils/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vendorId = url.searchParams.get("vendor_id");
  if (!vendorId) return new Response("vendor_id required", { status: 400 });

  const data = await getVendorStatement(vendorId, {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!data) return new Response("Not found", { status: 404 });

  const sections: string[] = [];
  sections.push(`# Vendor Statement — ${data.vendor_name}`);
  sections.push(`# Period — ${data.period_label}\n`);
  sections.push(`Total billed,${data.total_billed.toFixed(2)}`);
  sections.push(`Total paid,${data.total_paid.toFixed(2)}`);
  sections.push(`Total outstanding,${data.total_outstanding.toFixed(2)}\n`);

  sections.push(`## Expenses`);
  sections.push(toCsv(data.rows as unknown as Record<string, unknown>[], ["expense_date", "invoice_no", "total", "paid_amount", "balance", "payment_status"]));

  const safeName = data.vendor_name.replace(/[^A-Za-z0-9-_]/g, "_");
  return csvResponse(`vendor-statement-${safeName}.csv`, sections.join("\n"));
}
