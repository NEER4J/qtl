import { getSalesAnalytics } from "@/lib/actions/analytics";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = await getSalesAnalytics({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    location_id: url.searchParams.get("location_id") ?? undefined,
    service_type_id: url.searchParams.get("service_type_id") ?? undefined,
    payment_mode: url.searchParams.get("payment_mode") ?? undefined,
  });

  const sections: string[] = [];
  sections.push(`# Sales Analytics — ${data.period_label}\n`);
  sections.push(`Total revenue,${data.total_revenue.toFixed(2)}`);
  sections.push(`Total jobs,${data.total_jobs}`);
  sections.push(`Avg job value,${data.avg_job_value.toFixed(2)}`);
  sections.push(`Outstanding,${data.outstanding.toFixed(2)}\n`);

  sections.push(`## Daily trend`);
  sections.push(toCsv(data.daily_trend as unknown as Record<string, unknown>[], ["day", "total", "count"]));
  sections.push("");

  sections.push(`## By location`);
  sections.push(toCsv(data.by_location as unknown as Record<string, unknown>[], ["location_code", "location_name", "total", "count"]));
  sections.push("");

  sections.push(`## By payment mode`);
  sections.push(toCsv(data.by_payment_mode as unknown as Record<string, unknown>[], ["mode", "total"]));
  sections.push("");

  sections.push(`## Top customers`);
  sections.push(toCsv(data.top_customers as unknown as Record<string, unknown>[], ["billing_name", "count", "total"]));

  return csvResponse(`sales-analytics-${todayISO()}.csv`, sections.join("\n"));
}
