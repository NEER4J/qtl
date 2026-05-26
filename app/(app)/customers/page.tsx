import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listCustomers } from "@/lib/actions/customers";
import { hiddenColumnsForPage } from "@/lib/permissions/check";

import { CustomersTable } from "./customers-table";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const profile = await requireRole("owner", "co_owner", "manager", "staff");
  const customers = await listCustomers();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          {customers.length} customer{customers.length !== 1 ? "s" : ""} total
        </p>
      </div>
      <PageHelp id="customers-list">
        <p>
          Your customer directory — one entry per trucking company or billing name. Customers are added either by typing a new name on a sales job (the system creates the record for you) or by adding them manually here.
        </p>
        <ul>
          <li><strong>License plates</strong> — one customer can have several trucks. When you&apos;re filling out a sales job, you can search by any of their plates.</li>
          <li><strong>Deactivating</strong> a customer hides them from the search box on forms but keeps all their history.</li>
          <li>Double-click any row to open the customer profile — contact info, job history, outstanding balance, and the ability to give them a login so they can see their own invoices.</li>
        </ul>
      </PageHelp>

      <CustomersTable
        customers={customers}
        hiddenColumns={[...hiddenColumnsForPage(profile, "customers")]}
      />
    </div>
  );
}
