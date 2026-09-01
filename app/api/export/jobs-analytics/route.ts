import { getJobsAnalytics } from "@/lib/actions/analytics";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = await getJobsAnalytics({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    location_id: url.searchParams.get("location_id") ?? undefined,
    service_type_id: url.searchParams.get("service_type_id") ?? undefined,
    bay_no: url.searchParams.get("bay_no") ?? undefined,
  });

  const sections: string[] = [];
  sections.push(`# Job Duration Analytics — ${data.period_label}\n`);
  sections.push(`Total jobs,${data.total_jobs}`);
  sections.push(`Avg duration (min),${data.avg_duration_minutes.toFixed(1)}`);
  sections.push(`Fastest bay,${data.fastest_bay ? `Bay ${data.fastest_bay.bay_no} (${data.fastest_bay.avg_minutes.toFixed(1)} min)` : ""}`);
  sections.push(`Busiest hour,${data.busiest_hour ? `${data.busiest_hour.hour}:00 (${data.busiest_hour.count} jobs)` : ""}\n`);

  sections.push(`## By service type`);
  sections.push(toCsv(data.by_service_type as unknown as Record<string, unknown>[], ["code", "name", "count", "avg_minutes"]));
  sections.push("");

  sections.push(`## By bay`);
  sections.push(toCsv(data.by_bay as unknown as Record<string, unknown>[], ["bay_no", "count", "avg_minutes"]));
  sections.push("");

  sections.push(`## By hour of day`);
  sections.push(toCsv(data.by_hour as unknown as Record<string, unknown>[], ["hour", "count"]));
  sections.push("");

  sections.push(`## By day of week`);
  sections.push(toCsv(data.by_dow as unknown as Record<string, unknown>[], ["dow", "count"]));
  sections.push("");

  sections.push(`## Volume trend`);
  sections.push(toCsv(data.volume_trend as unknown as Record<string, unknown>[], ["day", "count"]));
  sections.push("");

  sections.push(`## Duration buckets`);
  sections.push(toCsv(data.duration_buckets as unknown as Record<string, unknown>[], ["bucket", "count"]));

  return csvResponse(`jobs-analytics-${todayISO()}.csv`, sections.join("\n"));
}
