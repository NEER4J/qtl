import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listCustomersPaged } from "@/lib/actions/customers";
import { hiddenColumnsForPage } from "@/lib/permissions/check";

import { CustomersTable } from "./customers-table";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRole("owner", "co_owner", "manager", "staff");

  const params = await searchParams;
  const singleParams = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );

  const result = await listCustomersPaged(singleParams);
  const searching = Boolean(singleParams.q);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          {result.total.toLocaleString()} customer{result.total !== 1 ? "s" : ""}
          {searching ? " matching your search" : " total"}
        </p>
      </div>
      <PageHelp id="customers-list">
        <p>
          Your customer directory — one entry per trucking company or billing name. Customers are added either by typing a new name on a sales job (the system creates the record for you) or by adding them manually here.
        </p>
        <ul>
          <li><strong>Search</strong> looks through every customer, not just the ones on screen — by name, email, phone, or any license plate on file.</li>
          <li><strong>License plates</strong> — one customer can have several trucks. When you&apos;re filling out a sales job, you can search by any of their plates.</li>
          <li><strong>Deactivating</strong> a customer hides them from the search box on forms but keeps all their history.</li>
          <li>Double-click any row to open the customer profile — contact info, job history, outstanding balance, and the ability to give them a login so they can see their own invoices.</li>
        </ul>
      </PageHelp>

      <CustomersTable
        rows={result.rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        hiddenColumns={[...hiddenColumnsForPage(profile, "customers")]}
      />
    </div>
  );
}
