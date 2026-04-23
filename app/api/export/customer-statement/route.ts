import { getCustomerStatement } from "@/lib/actions/reports";
import { csvResponse, toCsv } from "@/lib/utils/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customer_id");
  if (!customerId) return new Response("customer_id required", { status: 400 });

  const data = await getCustomerStatement(customerId, {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!data) return new Response("Not found", { status: 404 });

  const sections: string[] = [];
  sections.push(`# Customer Statement — ${data.customer_name}`);
  sections.push(`# Period — ${data.period_label}\n`);
  sections.push(`Total billed,${data.total_billed.toFixed(2)}`);
  sections.push(`Total paid,${data.total_paid.toFixed(2)}`);
  sections.push(`Total outstanding,${data.total_outstanding.toFixed(2)}\n`);

  sections.push(`## Invoices`);
  sections.push(toCsv(data.rows as unknown as Record<string, unknown>[], ["job_date", "invoice_no", "total", "paid_amount", "outstanding", "payment_status"]));

  const safeName = data.customer_name.replace(/[^A-Za-z0-9-_]/g, "_");
  return csvResponse(`customer-statement-${safeName}.csv`, sections.join("\n"));
}
