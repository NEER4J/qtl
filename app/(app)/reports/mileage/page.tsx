import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { PageHelp } from "@/components/help/page-help";
import { getCustomer } from "@/lib/actions/customers";
import { getMileageReport } from "@/lib/actions/mileage";
import { listActiveLocations } from "@/lib/actions/reference";
import { requirePage } from "@/lib/auth/require";
import { accessibleLocationIds, canChooseLocation } from "@/lib/auth/locations";
import { formatDate } from "@/lib/utils/format";
import { MAX_KM_PER_DAY, MILEAGE_RULE } from "@/lib/utils/mileage";
import { CustomerFilter } from "./customer-filter";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Rows drawn on screen; the CSV has every vehicle. */
const SCREEN_ROWS = 500;

const km = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(n).toLocaleString("en-CA")} km`;

export default async function MileageReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requirePage("reports_mileage");
  const sp = await searchParams;
  const customerId = sp.customer_id && UUID_RE.test(sp.customer_id) ? sp.customer_id : undefined;

  const [report, locations, customer] = await Promise.all([
    getMileageReport({
      from: sp.from,
      to: sp.to,
      location_id: sp.location_id,
      customer_id: customerId,
    }),
    listActiveLocations(),
    customerId ? getCustomer(customerId) : Promise.resolve(null),
  ]);
  const s = report.summary;
  const withMileage = report.vehicles.filter((v) => v.km_covered != null);
  const shown = withMileage.slice(0, SCREEN_ROWS);
  const allowed = accessibleLocationIds(profile);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mileage</h1>
        <p className="text-sm text-muted-foreground">
          How far trucks run between services, from the odometer recorded on each job ·{" "}
          {formatDate(report.from)} → {formatDate(report.to)}
          {customer ? ` · ${customer.billing_name ?? customer.last_or_company}` : ""}
        </p>
      </div>

      <PageHelp id="reports-mileage">
        <p>Mileage per vehicle from the odometer reading typed on each job.</p>
        <ul>
          <li>
            <strong>Km between services</strong> — km from a vehicle&apos;s first to last counted
            reading in the period, divided by the gaps between them. The fleet figure is all those
            km divided by all those gaps.
          </li>
          <li>
            <strong>Km per day</strong> — the same km divided by the days from first to last
            reading.
          </li>
          <li>
            <strong>Which readings count:</strong> {MILEAGE_RULE}
          </li>
          <li>Only jobs linked to a vehicle are included. The period defaults to the last 12 months.</li>
        </ul>
      </PageHelp>

      <div className="flex flex-wrap items-end gap-3">
        <CustomerFilter
          customerId={customerId ?? null}
          customerName={customer ? (customer.billing_name ?? customer.last_or_company) : null}
        />
        <div className="min-w-0 flex-1">
          <AnalyticsFilters
            locations={locations.filter((l) => allowed?.includes(l.id) ?? true)}
            canFilterLocation={canChooseLocation(profile)}
            exportHref="/api/export/mileage"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Vehicles serviced"
          value={s.vehicles.toLocaleString("en-CA")}
          hint={`${s.vehicles_with_mileage.toLocaleString("en-CA")} with 2+ readings`}
        />
        <Stat
          label="Avg km between services"
          value={km(s.avg_km_between)}
          hint={`over ${s.intervals.toLocaleString("en-CA")} intervals`}
        />
        <Stat label="Avg km per day" value={km(s.avg_km_per_day)} hint="per vehicle" />
        <Stat label="Avg odometer at service" value={km(s.avg_odometer_at_service)} />
        <Stat label="Km covered" value={km(s.total_km)} hint="all vehicles, first → last reading" />
        <Stat
          label="Readings counted"
          value={`${s.readings_counted.toLocaleString("en-CA")} of ${s.visits.toLocaleString("en-CA")}`}
          hint={`${s.readings_skipped.toLocaleString("en-CA")} out of line · ${s.visits_without_reading.toLocaleString("en-CA")} blank`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Vehicles with a mileage ({withMileage.length.toLocaleString("en-CA")})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Most km first.{" "}
            {withMileage.length > SCREEN_ROWS
              ? `Showing the first ${SCREEN_ROWS} — the CSV has every vehicle, including those with fewer than two readings.`
              : "The CSV also lists vehicles with fewer than two readings."}{" "}
            Readings implying more than {MAX_KM_PER_DAY.toLocaleString("en-CA")} km a day are
            treated as typos.
          </p>
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-220px)] overflow-auto p-0">
          {shown.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No vehicle has two counted readings in this period.
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Plate</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Readings</TableHead>
                  <TableHead className="text-right">First reading</TableHead>
                  <TableHead className="text-right">Last reading</TableHead>
                  <TableHead className="text-right">Km covered</TableHead>
                  <TableHead className="text-right">Km between services</TableHead>
                  <TableHead className="text-right">Km / day</TableHead>
                  <TableHead>Last service</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((v) => (
                  <TableRow key={v.vehicle_id}>
                    <TableCell className="font-mono">
                      {v.customer_id ? (
                        <Link
                          href={`/customers/${v.customer_id}/vehicles/${v.vehicle_id}/history`}
                          className="hover:underline"
                        >
                          {v.plate}
                        </Link>
                      ) : (
                        v.plate
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {v.customer_id ? (
                        <Link href={`/customers/${v.customer_id}`} className="hover:underline">
                          {v.customer_name ?? "—"}
                        </Link>
                      ) : (
                        (v.customer_name ?? "—")
                      )}
                    </TableCell>
                    <TableCell>{v.unit_no ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{v.vehicle ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.visits}</TableCell>
                    <TableCell
                      className="text-right tabular-nums"
                      title={v.skipped ? `${v.skipped} reading(s) not counted` : undefined}
                    >
                      {v.readings}
                      {v.skipped > 0 && <span className="text-amber-600"> (+{v.skipped})</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {km(v.first_km)}
                      <div className="text-[10px] text-muted-foreground">{formatDate(v.first_date)}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {km(v.last_km)}
                      <div className="text-[10px] text-muted-foreground">{formatDate(v.last_date)}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{km(v.km_covered)}</TableCell>
                    <TableCell className="text-right tabular-nums">{km(v.avg_km_between)}</TableCell>
                    <TableCell className="text-right tabular-nums">{km(v.avg_km_per_day)}</TableCell>
                    <TableCell>{formatDate(v.last_service_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
