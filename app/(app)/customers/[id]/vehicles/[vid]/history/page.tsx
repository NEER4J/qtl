import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/sales/status-badge";
import { getCustomer } from "@/lib/actions/customers";
import { getVehicle, getVehicleSalesHistory } from "@/lib/actions/vehicles";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function VehicleHistoryPage({
  params,
}: {
  params: Promise<{ id: string; vid: string }>;
}) {
  const { id, vid } = await params;
  const [customer, vehicle] = await Promise.all([getCustomer(id), getVehicle(vid)]);
  if (!customer || !vehicle || vehicle.customer_id !== id) notFound();

  const jobs = await getVehicleSalesHistory(vehicle);

  const totalSpent = jobs.reduce((s, j) => s + j.total, 0);
  const totalOutstanding = jobs.reduce((s, j) => s + j.outstanding, 0);
  const lastVisit = jobs[0]?.job_date ?? null;

  const displayName = customer.billing_name ?? customer.last_or_company ?? "";
  const description = [vehicle.year, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href={`/customers/${id}`}>
            <ChevronLeft className="size-4" /> Back to {displayName}
          </Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Service history — <span className="font-mono">{vehicle.license_plate}</span>
          </h1>
          {description && <Badge variant="outline">{description}</Badge>}
          {vehicle.unit_number && (
            <Badge variant="outline">Unit #{vehicle.unit_number}</Badge>
          )}
          {vehicle.deactivated_at && <Badge variant="secondary">Deactivated</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Visits" value={String(jobs.length)} />
        <Stat label="Total spent" value={formatMoney(totalSpent)} />
        <Stat
          label="Outstanding"
          value={formatMoney(totalOutstanding)}
          highlight={totalOutstanding > 0}
        />
        <Stat label="Last visit" value={lastVisit ? formatDate(lastVisit) : "—"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jobs on this vehicle</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No jobs recorded for this vehicle yet.
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Odometer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>{formatDate(j.job_date)}</TableCell>
                    <TableCell className="font-mono text-sm">#{j.invoice_no}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {j.odometer != null ? j.odometer.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={j.payment_status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(j.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {j.outstanding > 0 ? (
                        <span className="font-medium text-rose-600">
                          {formatMoney(j.outstanding)}
                        </span>
                      ) : (
                        formatMoney(0)
                      )}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/sales/${j.id}`}>View</Link>
                      </Button>
                    </TableCell>
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

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${highlight ? "text-rose-600" : ""}`}>
        {value}
      </div>
    </div>
  );
}
