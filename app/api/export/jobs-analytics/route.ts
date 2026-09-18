import { getDeckAnalytics, getJobsAnalytics } from "@/lib/actions/analytics";
import { requireProfile } from "@/lib/auth/require";
import { isPageAllowed } from "@/lib/permissions/check";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { todayISO } from "@/lib/utils/tz";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // API routes sit outside the (app) layout's page gate, so check it here: the
  // file now carries sales per technician, which is Analytics-page data.
  const profile = await requireProfile();
  if (!isPageAllowed(profile, "analytics")) {
    return new Response("You don't have access to Analytics.", { status: 403 });
  }

  const url = new URL(req.url);
  const filter = {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    location_id: url.searchParams.get("location_id") ?? undefined,
    service_type_id: url.searchParams.get("service_type_id") ?? undefined,
    bay_no: url.searchParams.get("bay_no") ?? undefined,
  };
  const technician = url.searchParams.get("technician") ?? undefined;
  const [data, decks] = await Promise.all([
    getJobsAnalytics(filter),
    getDeckAnalytics({ ...filter, technician }),
  ]);

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

  if (decks.supported) {
    sections.push("");
    sections.push(`## Decks — coverage${technician ? ` (jobs with ${technician})` : ""}`);
    sections.push(toCsv(decks.coverage as unknown as Record<string, unknown>[], ["deck", "assigned", "blank"]));
    sections.push("");
    sections.push(`## Decks — by technician`);
    sections.push(toCsv(decks.by_tech as unknown as Record<string, unknown>[], ["deck", "tech", "jobs", "revenue", "avg_minutes", "timed_jobs"]));
    sections.push("");
    sections.push(`## Decks — service types by technician`);
    sections.push(toCsv(decks.service_mix as unknown as Record<string, unknown>[], ["deck", "tech", "service_code", "service_name", "jobs"]));
    sections.push("");
    sections.push(`## Decks — who works together`);
    sections.push(toCsv(decks.pairs as unknown as Record<string, unknown>[], ["upper_tech", "lower_tech", "jobs", "revenue"]));
    sections.push("");
    sections.push(`## Decks — per week`);
    sections.push(toCsv(decks.weekly as unknown as Record<string, unknown>[], ["week", "jobs", "upper", "lower"]));
  }

  return csvResponse(`jobs-analytics-${todayISO()}.csv`, sections.join("\n"));
}
