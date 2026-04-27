import { getProductsAnalytics } from "@/lib/actions/analytics";
import { csvResponse, toCsv } from "@/lib/utils/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = await getProductsAnalytics({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    location_id: url.searchParams.get("location_id") ?? undefined,
  });

  const sections: string[] = [];
  sections.push(`# Products & Services Analytics — ${data.period_label}\n`);
  sections.push(`Total jobs,${data.total_jobs}`);
  sections.push(`Most performed,${data.most_performed ?? ""}`);
  sections.push(`Highest revenue,${data.highest_revenue ?? ""}\n`);

  sections.push(`## By count`);
  sections.push(toCsv(data.by_count as unknown as Record<string, unknown>[], ["code", "name", "count"]));
  sections.push("");

  sections.push(`## By revenue`);
  sections.push(toCsv(data.by_revenue as unknown as Record<string, unknown>[], ["code", "name", "total"]));
  sections.push("");

  sections.push(`## Per location`);
  sections.push(toCsv(data.by_location as unknown as Record<string, unknown>[], ["name", "code", "count"]));
  sections.push("");

  sections.push(`## Monthly trend`);
  sections.push(toCsv(data.trend as unknown as Record<string, unknown>[], Object.keys(data.trend[0] ?? { month: "" })));

  return csvResponse(`products-analytics-${new Date().toISOString().slice(0, 10)}.csv`, sections.join("\n"));
}
