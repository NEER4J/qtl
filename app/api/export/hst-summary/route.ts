import { getHstSummary } from "@/lib/actions/reports";
import { csvResponse, toCsv } from "@/lib/utils/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = await getHstSummary({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    location_id: url.searchParams.get("location_id") ?? undefined,
  });

  const sections: string[] = [];
  sections.push(`# HST Summary — ${data.period_label}\n`);
  sections.push(`Sales total,${data.sales_total.toFixed(2)}`);
  sections.push(`Expense total,${data.expense_total.toFixed(2)}`);
  sections.push(`HST collected,${data.hst_collected.toFixed(2)}`);
  sections.push(`HST paid,${data.hst_paid.toFixed(2)}`);
  sections.push(`Net HST payable,${data.net_hst_payable.toFixed(2)}\n`);

  sections.push(`## Monthly breakdown`);
  sections.push(toCsv(data.by_month as unknown as Record<string, unknown>[], ["month", "hst_collected", "hst_paid"]));
  sections.push("");

  sections.push(`## By location`);
  sections.push(toCsv(data.by_location as unknown as Record<string, unknown>[], ["location_name", "hst_collected", "hst_paid"]));

  return csvResponse(`hst-summary-${new Date().toISOString().slice(0, 10)}.csv`, sections.join("\n"));
}
