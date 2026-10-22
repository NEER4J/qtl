import { getMileageReport } from "@/lib/actions/mileage";
import { requireProfile } from "@/lib/auth/require";
import { isPageAllowed } from "@/lib/permissions/check";
import { pageKeyForRequestPath } from "@/lib/permissions/registry";
import { csvResponse, toCsv } from "@/lib/utils/csv";
import { MILEAGE_RULE } from "@/lib/utils/mileage";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const round = (n: number | null) => (n == null ? "" : Math.round(n));

/** Every vehicle serviced in the period with its mileage (client 2026-10-20). */
export async function GET(req: Request) {
  // API routes sit outside the (app) layout's page gate, so check it here.
  const profile = await requireProfile();
  if (!isPageAllowed(profile, pageKeyForRequestPath("/reports/mileage") ?? "reports")) {
    return new Response("You don't have access to Reports.", { status: 403 });
  }

  const url = new URL(req.url);
  const customerId = url.searchParams.get("customer_id");
  const report = await getMileageReport({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    location_id: url.searchParams.get("location_id") ?? undefined,
    customer_id: customerId && UUID_RE.test(customerId) ? customerId : undefined,
  });
  const s = report.summary;

  const sections: string[] = [];
  sections.push(`# Mileage — ${report.from} to ${report.to}`);
  sections.push(`# ${MILEAGE_RULE.replace(/,/g, ";")}`);
  sections.push("");
  sections.push("## Summary");
  sections.push(
    toCsv(
      [
        { item: "Vehicles serviced", value: s.vehicles },
        { item: "Vehicles with 2+ counted readings", value: s.vehicles_with_mileage },
        { item: "Visits", value: s.visits },
        { item: "Readings counted", value: s.readings_counted },
        { item: "Readings not counted (out of line)", value: s.readings_skipped },
        { item: "Visits with no reading", value: s.visits_without_reading },
        { item: "Km covered", value: round(s.total_km) },
        { item: "Average km between services", value: round(s.avg_km_between) },
        { item: "Average km per day", value: round(s.avg_km_per_day) },
        { item: "Average odometer at service", value: round(s.avg_odometer_at_service) },
      ],
      ["item", "value"],
    ),
  );
  sections.push("");
  sections.push("## Vehicles");
  sections.push(
    toCsv(
      report.vehicles.map((v) => ({
        plate: v.plate,
        customer: v.customer_name ?? "",
        unit_no: v.unit_no ?? "",
        vehicle: v.vehicle ?? "",
        visits: v.visits,
        readings_counted: v.readings,
        readings_not_counted: v.skipped,
        first_reading_date: v.first_date ?? "",
        first_reading_km: v.first_km ?? "",
        last_reading_date: v.last_date ?? "",
        last_reading_km: v.last_km ?? "",
        km_covered: v.km_covered ?? "",
        avg_km_between_services: round(v.avg_km_between),
        avg_km_per_day: round(v.avg_km_per_day),
        last_service_date: v.last_service_date,
      })),
      [
        "plate",
        "customer",
        "unit_no",
        "vehicle",
        "visits",
        "readings_counted",
        "readings_not_counted",
        "first_reading_date",
        "first_reading_km",
        "last_reading_date",
        "last_reading_km",
        "km_covered",
        "avg_km_between_services",
        "avg_km_per_day",
        "last_service_date",
      ],
    ),
  );

  return csvResponse(`mileage-${report.from}-to-${report.to}.csv`, sections.join("\n"));
}
