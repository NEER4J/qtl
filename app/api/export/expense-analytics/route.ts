import { getExpenseAnalytics } from "@/lib/actions/analytics";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = await getExpenseAnalytics({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    location_id: url.searchParams.get("location_id") ?? undefined,
    category_id: url.searchParams.get("category_id") ?? undefined,
    vendor_id: url.searchParams.get("vendor_id") ?? undefined,
  });

  const sections: string[] = [];
  sections.push(`# Expense Analytics — ${data.period_label}\n`);
  sections.push(`Total expenses,${data.total_expenses.toFixed(2)}`);
  sections.push(`Outstanding payables,${data.outstanding_payables.toFixed(2)}\n`);

  sections.push(`## By category`);
  sections.push(toCsv(data.by_category as unknown as Record<string, unknown>[], ["name", "total"]));
  sections.push("");

  sections.push(`## By location`);
  sections.push(toCsv(data.by_location as unknown as Record<string, unknown>[], ["name", "total"]));
  sections.push("");

  sections.push(`## Monthly trend`);
  sections.push(toCsv(data.monthly_trend as unknown as Record<string, unknown>[], ["month", "total"]));
  sections.push("");

  sections.push(`## Top vendors`);
  sections.push(toCsv(data.top_vendors as unknown as Record<string, unknown>[], ["name", "total"]));

  return csvResponse(`expense-analytics-${todayISO()}.csv`, sections.join("\n"));
}
