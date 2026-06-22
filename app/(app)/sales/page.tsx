import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHelp } from "@/components/help/page-help";
import { requireProfile } from "@/lib/auth/require";
import { listSalesJobs } from "@/lib/actions/sales";
import { listActiveLocations, listActiveServiceTypes } from "@/lib/actions/reference";
import { hiddenColumnsForPage } from "@/lib/permissions/check";

import { SalesFilters } from "./sales-filters";
import { SalesTable } from "./sales-table";

export const dynamic = "force-dynamic";

export default async function SalesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  if (profile.role === "employee") {
    // Employees have no access; redirect-style guard
    return <div className="text-sm text-muted-foreground">You do not have access to sales.</div>;
  }

  const params = await searchParams;
  const singleParams = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );

  const [result, locations, serviceTypes] = await Promise.all([
    listSalesJobs(singleParams),
    listActiveLocations(),
    listActiveServiceTypes(),
  ]);

  const showLocationFilter =
    profile.role === "owner"
    || profile.role === "co_owner"
    || profile.role === "accountant"
    || profile.cross_location; // cross-location managers/staff can sort by location too
  const canCreate = profile.role !== "accountant";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">
            {result.total.toLocaleString()} job{result.total === 1 ? "" : "s"}
            {result.total > result.pageSize
              ? ` — page ${result.page} of ${Math.ceil(result.total / result.pageSize)}`
              : ""}
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/sales/new">
              <Plus className="size-4" /> New job
            </Link>
          </Button>
        )}
      </div>

      <PageHelp id="sales-list">
        <p>
          Every job that comes through a bay is recorded here as an invoice. Click any row to see the full details, record a payment, edit, or download a PDF copy.
        </p>
        <ul>
          <li><strong>New job</strong> opens the entry form. Fill in the customer, service type, amounts, and (optionally) start/end times.</li>
          <li><strong>Filters</strong> narrow the list by date, location, service, payment mode, or status. You can bookmark or share any filtered view — the filters travel in the web address.</li>
          <li><strong>Status labels</strong>: green &quot;Paid&quot;, amber &quot;Partial&quot;, red &quot;Outstanding&quot;. These update automatically as payments come in.</li>
          <li><strong>Deactivating</strong> a job hides it from the list but keeps the history. Nothing is permanently erased. Only owners can deactivate.</li>
        </ul>
        <p>
          Managers see only their own shop. Staff can create new jobs but can&apos;t edit them after saving — ask a manager or owner if something needs correcting.
        </p>
      </PageHelp>

      <SalesFilters
        initial={singleParams}
        locations={showLocationFilter ? locations : undefined}
        serviceTypes={serviceTypes}
      />

      <SalesTable
        rows={result.rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        hiddenColumns={[...hiddenColumnsForPage(profile, "sales")]}
      />
    </div>
  );
}
