import { getOutstandingInvoices } from "@/lib/actions/reports";
import { csvResponse, toReportCsv } from "@/lib/utils/csv";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const { rows, total_outstanding, by_bucket } = await getOutstandingInvoices({
    from,
    to,
    location_id: url.searchParams.get("location_id") ?? undefined,
  });

  const sections: string[] = [];
  sections.push(`# Outstanding Invoices — as of ${todayISO()}`);
  if (from || to) sections.push(`# Invoices dated ${from ?? "the start"} to ${to ?? "today"}`);
  sections.push("");
  sections.push(`Total outstanding,${total_outstanding.toFixed(2)}`);
  for (const [bucket, amount] of Object.entries(by_bucket)) {
    sections.push(`${bucket},${amount.toFixed(2)}`);
  }
  sections.push("");

  sections.push(`## Invoices`);
  sections.push(
    toReportCsv(
      rows as unknown as Record<string, unknown>[],
      ["invoice_no", "job_date", "billing_name", "location_name", "days_overdue", "bucket", "total", "paid_amount", "outstanding"],
    ),
  );

  return csvResponse(`outstanding-${todayISO()}.csv`, sections.join("\n"));
}
