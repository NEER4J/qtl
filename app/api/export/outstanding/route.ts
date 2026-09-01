import { getOutstandingInvoices } from "@/lib/actions/reports";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { rows, total_outstanding, by_bucket } = await getOutstandingInvoices({
    location_id: url.searchParams.get("location_id") ?? undefined,
  });

  const sections: string[] = [];
  sections.push(`# Outstanding Invoices — as of ${todayISO()}\n`);
  sections.push(`Total outstanding,${total_outstanding.toFixed(2)}`);
  for (const [bucket, amount] of Object.entries(by_bucket)) {
    sections.push(`${bucket},${amount.toFixed(2)}`);
  }
  sections.push("");

  sections.push(`## Invoices`);
  sections.push(
    toCsv(
      rows as unknown as Record<string, unknown>[],
      ["invoice_no", "job_date", "billing_name", "location_name", "days_overdue", "bucket", "total", "paid_amount", "outstanding"],
    ),
  );

  return csvResponse(`outstanding-${todayISO()}.csv`, sections.join("\n"));
}
