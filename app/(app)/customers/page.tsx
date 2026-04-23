import { requireRole } from "@/lib/auth/require";
import { listCustomers } from "@/lib/actions/customers";
import { listActiveLocations } from "@/lib/actions/reference";

import { CustomersTable } from "./customers-table";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requireRole("owner", "manager", "staff");
  const [customers, locations] = await Promise.all([
    listCustomers(),
    listActiveLocations(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          {customers.length} customer{customers.length !== 1 ? "s" : ""} total
        </p>
      </div>
      <CustomersTable customers={customers} locations={locations} />
    </div>
  );
}
