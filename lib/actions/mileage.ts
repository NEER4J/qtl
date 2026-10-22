"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRowsParallel } from "@/lib/supabase/fetch-all";
import { requireProfile } from "@/lib/auth/require";
import { applyLocationFilter, resolveLocationFilter } from "@/lib/auth/locations";
import { analyseOdometer } from "@/lib/utils/mileage";
import { ISO_DATE_RE, addDaysISO, todayISO } from "@/lib/utils/tz";

// ============================================================================
// Mileage report (client 2026-10-20 — "average job mileage"). Per vehicle,
// from the odometer typed on each job (sales_jobs.odometer); vehicles.mileage
// is a hand-entered estimate and isn't used. Which readings count is decided
// by lib/utils/mileage.ts. About 10k jobs a year: read in pages and worked
// out here rather than in SQL.
// ============================================================================

export interface MileageFilter {
  from?: string;
  to?: string;
  location_id?: string;
  customer_id?: string;
}

export interface MileageVehicleRow {
  vehicle_id: string;
  plate: string;
  unit_no: string | null;
  /** "2019 Freightliner Cascadia" */
  vehicle: string | null;
  customer_id: string | null;
  customer_name: string | null;
  visits: number;
  /** Readings that count (see lib/utils/mileage.ts). */
  readings: number;
  /** Visits with a reading that didn't count. */
  skipped: number;
  first_date: string | null;
  first_km: number | null;
  last_date: string | null;
  last_km: number | null;
  km_covered: number | null;
  avg_km_between: number | null;
  avg_km_per_day: number | null;
  last_service_date: string;
}

export interface MileageReport {
  from: string;
  to: string;
  vehicles: MileageVehicleRow[];
  summary: {
    vehicles: number;
    /** Vehicles with two or more counted readings — the ones with a mileage. */
    vehicles_with_mileage: number;
    visits: number;
    readings_counted: number;
    readings_skipped: number;
    visits_without_reading: number;
    total_km: number;
    /** Gaps between consecutive counted readings, all vehicles. */
    intervals: number;
    /** Total km ÷ total intervals between counted readings. */
    avg_km_between: number | null;
    /** Total km ÷ total days between each vehicle's first and last counted reading. */
    avg_km_per_day: number | null;
    /** Mean of every counted reading. */
    avg_odometer_at_service: number | null;
  };
}

type Rel<T> = T | T[] | null;
const one = <T,>(r: Rel<T>): T | null => (Array.isArray(r) ? (r[0] ?? null) : r);

export async function getMileageReport(filter: MileageFilter = {}): Promise<MileageReport> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const to = filter.to && ISO_DATE_RE.test(filter.to) ? filter.to : todayISO();
  // Default: the last 12 months.
  const from = filter.from && ISO_DATE_RE.test(filter.from) ? filter.from : addDaysISO(to, -365);
  const { ids: locationIds } = resolveLocationFilter(profile, filter.location_id);

  type Row = {
    id: string;
    job_date: string;
    created_at: string;
    odometer: number | null;
    vehicle_id: string;
    unit_no: string | null;
    license_plate: string | null;
    vehicles: Rel<{
      license_plate: string | null;
      unit_number: string | null;
      year: number | null;
      make: string | null;
      model: string | null;
      customer_id: string | null;
      customers: Rel<{ billing_name: string | null; last_or_company: string | null }>;
    }>;
  };
  const rows = await fetchAllRowsParallel<Row>((lo, hi, count) => {
    let q = supabase
      .from("sales_jobs")
      .select(
        `id, job_date, created_at, odometer, vehicle_id, unit_no, license_plate,
         vehicles:vehicle_id(license_plate, unit_number, year, make, model, customer_id,
           customers:customer_id(billing_name, last_or_company))`,
        { count },
      )
      .is("deactivated_at", null)
      .not("vehicle_id", "is", null)
      .gte("job_date", from)
      .lte("job_date", to);
    q = applyLocationFilter(q, "location_id", locationIds);
    if (filter.customer_id) q = q.eq("customer_id", filter.customer_id);
    return q.order("id").range(lo, hi);
  });

  const byVehicle = new Map<string, Row[]>();
  for (const r of rows) {
    const list = byVehicle.get(r.vehicle_id);
    if (list) list.push(r);
    else byVehicle.set(r.vehicle_id, [r]);
  }

  const vehicles: MileageVehicleRow[] = [];
  let readingsCounted = 0;
  let readingsSkipped = 0;
  let noReading = 0;
  let totalKm = 0;
  let totalIntervals = 0;
  let totalDays = 0;
  // Km over vehicles whose readings span at least a day: the km/day average
  // can't count km from same-day readings, which add no days.
  let kmWithDays = 0;
  let odometerSum = 0;
  for (const [vehicleId, visits] of byVehicle) {
    const { perVisit, summary } = analyseOdometer(visits);
    let skipped = 0;
    for (const v of visits) {
      const r = perVisit.get(v.id)!;
      if (r.counted) odometerSum += v.odometer!;
      else if (r.skipped === "out_of_line") skipped++;
      else noReading++;
    }
    readingsCounted += summary.readings;
    readingsSkipped += skipped;
    if (summary.km_covered != null) {
      totalKm += summary.km_covered;
      totalIntervals += summary.readings - 1;
      if (summary.days) {
        totalDays += summary.days;
        kmWithDays += summary.km_covered;
      }
    }

    const latest = visits.reduce((a, b) =>
      b.job_date > a.job_date || (b.job_date === a.job_date && b.created_at > a.created_at) ? b : a,
    );
    const veh = one(latest.vehicles);
    const cust = one(veh?.customers ?? null);
    vehicles.push({
      vehicle_id: vehicleId,
      plate: veh?.license_plate ?? latest.license_plate ?? "—",
      unit_no: veh?.unit_number || latest.unit_no || null,
      vehicle: [veh?.year, veh?.make, veh?.model].filter(Boolean).join(" ") || null,
      customer_id: veh?.customer_id ?? null,
      customer_name: cust?.billing_name ?? cust?.last_or_company ?? null,
      visits: visits.length,
      readings: summary.readings,
      skipped,
      first_date: summary.first?.date ?? null,
      first_km: summary.first?.km ?? null,
      last_date: summary.last?.date ?? null,
      last_km: summary.last?.km ?? null,
      km_covered: summary.km_covered,
      avg_km_between: summary.avg_km_between,
      avg_km_per_day: summary.avg_km_per_day,
      last_service_date: latest.job_date,
    });
  }

  // Most km first; vehicles without a mileage after, by plate.
  vehicles.sort(
    (a, b) =>
      (b.km_covered ?? -1) - (a.km_covered ?? -1) || a.plate.localeCompare(b.plate),
  );

  return {
    from,
    to,
    vehicles,
    summary: {
      vehicles: vehicles.length,
      vehicles_with_mileage: vehicles.filter((v) => v.km_covered != null).length,
      visits: rows.length,
      readings_counted: readingsCounted,
      readings_skipped: readingsSkipped,
      visits_without_reading: noReading,
      total_km: totalKm,
      intervals: totalIntervals,
      avg_km_between: totalIntervals > 0 ? totalKm / totalIntervals : null,
      avg_km_per_day: totalDays > 0 ? kmWithDays / totalDays : null,
      avg_odometer_at_service: readingsCounted > 0 ? odometerSum / readingsCounted : null,
    },
  };
}
