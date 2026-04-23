import { requireRole } from "@/lib/auth/require";
import { listVendors } from "@/lib/actions/vendors";
import { listActiveExpenseCategories } from "@/lib/actions/reference";

import { VendorsTable } from "./vendors-table";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  await requireRole("owner", "accountant", "manager");
  const [vendors, categories] = await Promise.all([
    listVendors(),
    listActiveExpenseCategories(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
        <p className="text-sm text-muted-foreground">
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} total
        </p>
      </div>
      <VendorsTable vendors={vendors} categories={categories} />
    </div>
  );
}
