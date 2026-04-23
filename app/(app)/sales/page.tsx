import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/require";
import { listSalesJobs } from "@/lib/actions/sales";
import { listActiveLocations, listActiveServiceTypes } from "@/lib/actions/reference";

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

  const showLocationFilter = profile.role === "owner" || profile.role === "accountant";
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

      <SalesFilters
        initial={singleParams}
        locations={showLocationFilter ? locations : undefined}
        serviceTypes={serviceTypes}
      />

      <SalesTable rows={result.rows} total={result.total} page={result.page} pageSize={result.pageSize} />
    </div>
  );
}
