import { getPayrollAnalytics } from "@/lib/actions/analytics";
import { csvResponse, toCsv } from "@/lib/utils/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = await getPayrollAnalytics({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    location_id: url.searchParams.get("location_id") ?? undefined,
  });

  const sections: string[] = [];
  sections.push(`# Payroll Analytics — ${data.period_label}\n`);
  sections.push(`Total cost,${data.total_cost.toFixed(2)}`);
  sections.push(`Total employees,${data.total_employees}`);
  sections.push(`Avg weekly per employee,${data.avg_weekly_per_employee.toFixed(2)}`);
  sections.push(`Payroll vs revenue,${data.payroll_vs_revenue_pct.toFixed(1)}%\n`);

  sections.push(`## By location`);
  sections.push(toCsv(data.by_location as unknown as Record<string, unknown>[], ["name", "total"]));
  sections.push("");

  sections.push(`## Weekly trend`);
  sections.push(toCsv(data.weekly_trend as unknown as Record<string, unknown>[], ["week_start", "location_name", "total"]));
  sections.push("");

  sections.push(`## Deductions by month`);
  sections.push(toCsv(data.deductions as unknown as Record<string, unknown>[], ["month", "ei", "cpp", "tax", "benefits"]));

  return csvResponse(`payroll-analytics-${new Date().toISOString().slice(0, 10)}.csv`, sections.join("\n"));
}
