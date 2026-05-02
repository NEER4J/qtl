import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";

import { AddVehicleButton } from "./add-vehicle-button";
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
import { CustomerForm } from "@/components/customers/customer-form";
import { StatusBadge } from "@/components/sales/status-badge";
import {
  getCustomer,
  getCustomerSalesHistory,
} from "@/lib/actions/customers";
import { getCustomerVehicles } from "@/lib/actions/vehicles";
import { listLocations } from "@/lib/actions/locations";
import { isFreeGreaseEligible } from "@/lib/utils/free-grease";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, jobs, vehicles, locations] = await Promise.all([
    getCustomer(id),
    getCustomerSalesHistory(id),
    getCustomerVehicles(id),
    listLocations(),
  ]);
  if (!customer) notFound();

  const totalSpent = jobs.reduce((s, j) => s + j.total, 0);
  const totalOutstanding = jobs.reduce((s, j) => s + j.outstanding, 0);

  const displayName =
    customer.billing_name ??
    [customer.first_name, customer.last_or_company].filter(Boolean).join(" ") ??
    "(no name)";

  const greaseEligible = isFreeGreaseEligible(customer);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href="/customers">
              <ChevronLeft className="size-4" /> Back to customers
            </Link>
          </Button>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
            {!customer.active && <Badge variant="secondary">Inactive</Badge>}
            <Badge variant="outline" className="capitalize">
              {customer.status}
            </Badge>
            {greaseEligible && (
              <Badge className="bg-emerald-600 hover:bg-emerald-700">
                Free grease until {formatDate(customer.free_grease_until!)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AddVehicleButton customerId={customer.id} />
          <Button asChild variant="outline" size="sm">
            <a href={`/api/export/customer-statement?customer_id=${customer.id}`} download>
              <Download className="size-4" /> Statement CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total jobs" value={String(jobs.length)} />
        <Stat label="Total spent" value={formatMoney(totalSpent)} />
        <Stat
          label="Outstanding"
          value={formatMoney(totalOutstanding)}
          highlight={totalOutstanding > 0}
        />
        <Stat label="Vehicles" value={String(vehicles.length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerForm
            customer={customer}
            initialVehicles={vehicles}
            locations={locations}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No jobs yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
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
