import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, ScrollText } from "lucide-react";

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
  getCustomerJobTotals,
  getCustomerRenameLinks,
  getCustomerSalesHistory,
  listFreeGreaseUsedVehicleIds,
} from "@/lib/actions/customers";
import { fetchCustomerCreditBalance } from "@/lib/actions/customer-credits";
import { getCustomerVehicles } from "@/lib/actions/vehicles";
import { requireProfile } from "@/lib/auth/require";
import { isPageAllowed } from "@/lib/permissions/check";
import { pageKeyForRequestPath } from "@/lib/permissions/registry";
import { isVehicleFreeGreaseEligible, vehicleFreeGreaseUntil } from "@/lib/utils/free-grease";
import { isFreeOilChangeEligible } from "@/lib/utils/free-oil-change";
import { formatDate, formatMoney } from "@/lib/utils/format";

import { GrantFreeOilChangeButton } from "./grant-free-oil-change-button";
import { MoveVehiclesButton } from "./move-vehicles-button";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // One wave: the rename links and the free-grease lookup chain off the
  // customer and vehicle reads rather than waiting for every first read.
  const customerPromise = getCustomer(id);
  const vehiclesPromise = getCustomerVehicles(id);
  const [customer, jobs, totals, vehicles, storeCredit, renameLinks, greaseUsedIds, profile] =
    await Promise.all([
      customerPromise,
      getCustomerSalesHistory(id),
      getCustomerJobTotals(id),
      vehiclesPromise,
      fetchCustomerCreditBalance(id),
      customerPromise.then((c) => (c ? getCustomerRenameLinks(c) : null)),
      vehiclesPromise.then((vs) => listFreeGreaseUsedVehicleIds(vs.map((v) => v.id))),
      requireProfile(),
    ]);
  if (!customer || !renameLinks) notFound();

  // Every job, not the 50 listed below (client 2026-10-20).
  const totalSpent = totals.total_spent;
  const totalOutstanding = totals.outstanding;
  const canSeeStatement = isPageAllowed(
    profile,
    pageKeyForRequestPath("/reports/customer-statement") ?? "reports",
  );

  const displayName =
    customer.billing_name ?? customer.last_or_company ?? "(no name)";

  // Free grease is per vehicle: once, in each vehicle's first 30 days.
  const usedGrease = new Set(greaseUsedIds);
  const greaseVehicles = vehicles.filter((v) => isVehicleFreeGreaseEligible(v, usedGrease));
  const oilChangeEligible = isFreeOilChangeEligible(customer);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href="/customers">
              <ChevronLeft className="size-4" /> Back to customers
            </Link>
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
            {!customer.active && <Badge variant="secondary">Inactive</Badge>}
            {greaseVehicles.map((v) => (
              <Badge key={v.id} className="bg-emerald-600 hover:bg-emerald-700">
                Free grease · {v.license_plate} until {formatDate(vehicleFreeGreaseUntil(v))}
              </Badge>
            ))}
            {oilChangeEligible && (
              <Badge className="bg-amber-600 hover:bg-amber-700">
                Free oil change until {formatDate(customer.free_oil_change_until!)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <GrantFreeOilChangeButton
            customerId={customer.id}
            alreadyEligible={oilChangeEligible}
          />
          <AddVehicleButton customerId={customer.id} />
          {canSeeStatement && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/reports/customer-statement?customer_id=${customer.id}`}>
                <ScrollText className="size-4" /> Monthly statement
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <a href={`/api/export/customer-statement?customer_id=${customer.id}`} download>
              <Download className="size-4" /> Statement CSV
            </a>
          </Button>
        </div>
      </div>

      {/* A rename keeps the old record for its history (0155). */}
      {renameLinks.renamedTo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <span>
            Renamed to{" "}
            <Link href={`/customers/${renameLinks.renamedTo.id}`} className="font-medium underline">
              {renameLinks.renamedTo.name}
            </Link>
            . This record keeps the invoices and history made under {displayName}; new jobs go on{" "}
            {renameLinks.renamedTo.name}.
          </span>
          {vehicles.length > 0 && (
            <MoveVehiclesButton
              fromCustomerId={customer.id}
              toCustomerId={renameLinks.renamedTo.id}
              toName={renameLinks.renamedTo.name}
              vehicles={vehicles}
            />
          )}
        </div>
      )}
      {renameLinks.renamedFrom && (
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
          Formerly{" "}
          <Link href={`/customers/${renameLinks.renamedFrom.id}`} className="font-medium underline">
            {renameLinks.renamedFrom.name}
          </Link>{" "}
          — invoices and history from before the rename are on that record.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total jobs" value={String(totals.job_count)} />
        <Stat label="Total spent" value={formatMoney(totalSpent)} />
        <Stat
          label="Outstanding"
          value={formatMoney(totalOutstanding)}
          highlight={totalOutstanding > 0}
        />
        <Stat
          label="Store credit"
          value={formatMoney(storeCredit)}
          highlight={storeCredit > 0}
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
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Job history
            {totals.job_count > jobs.length && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                latest {jobs.length} of {totals.job_count}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No jobs yet.
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
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
