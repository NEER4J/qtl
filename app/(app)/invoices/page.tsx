import { PageHelp } from "@/components/help/page-help";
import { requireProfile } from "@/lib/auth/require";
import { listSalesJobs } from "@/lib/actions/sales";
import { listActiveLocations } from "@/lib/actions/reference";
import { canChooseLocation } from "@/lib/auth/locations";

import { InvoicesFilters } from "./invoices-filters";
import { InvoicesTable } from "./invoices-table";

export const dynamic = "force-dynamic";

export default async function InvoicesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  if ((profile.role !== "owner" && profile.role !== "co_owner") && profile.role !== "manager" && profile.role !== "accountant") {
    return <div className="text-sm text-muted-foreground">You do not have access to invoices.</div>;
  }

  const params = await searchParams;
  const singleParams = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );

  const [result, locations] = await Promise.all([
    listSalesJobs(singleParams),
    listActiveLocations(),
  ]);

  // Anyone who can reach more than one shop gets the location column /
  // filter — all-locations roles and Multiple-mode users alike.
  const showLocationFilter = canChooseLocation(profile);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          {result.total.toLocaleString()} invoice{result.total === 1 ? "" : "s"}
          {result.total > result.pageSize
            ? ` — page ${result.page} of ${Math.ceil(result.total / result.pageSize)}`
            : ""}
        </p>
      </div>

      <PageHelp id="invoices-list">
        <p>
          Every sales job is also an invoice. This page is a billing-focused view: invoice number, total, paid, balance, and PDF status. Click any invoice number to open the full job, record a payment, or generate a fresh PDF.
        </p>
        <ul>
          <li><strong>Filters</strong> by date, location, and payment status. Bookmarkable — the filters travel in the URL.</li>
          <li><strong>PDF</strong> column shows whether a generated or uploaded PDF is on file. Use the download button to fetch the latest copy.</li>
          <li>Invoice numbers and totals match what you printed for the customer. Edits to a saved job update the invoice.</li>
        </ul>
      </PageHelp>

      <InvoicesFilters
        initial={singleParams}
        locations={showLocationFilter ? locations : undefined}
      />

      <InvoicesTable
        rows={result.rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
      />
    </div>
  );
}
