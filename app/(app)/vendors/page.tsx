import { PageHelp } from "@/components/help/page-help";
import { requirePage } from "@/lib/auth/require";
import { listVendors } from "@/lib/actions/vendors";
import { listActiveExpenseCategories } from "@/lib/actions/reference";
import { listLocations } from "@/lib/actions/locations";
import { hiddenColumnsForPage } from "@/lib/permissions/check";

import { VendorsTable } from "./vendors-table";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const profile = await requirePage("vendors");
  const [vendors, categories, locations] = await Promise.all([
    listVendors(),
    listActiveExpenseCategories(),
    listLocations(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
        <p className="text-sm text-muted-foreground">
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} total
        </p>
      </div>
      <PageHelp id="vendors-list">
        <p>
          Your vendor directory — one entry per supplier you pay. Like customers, vendors are created automatically when you type a new name on an expense.
        </p>
        <ul>
          <li><strong>Category</strong> — the default expense type for this vendor. When you pick them on an expense form, this pre-fills (but you can change it).</li>
          <li>Click any row to see the vendor profile: contact details, full expense history, balance owing, and a statement you can download.</li>
          <li><strong>Deactivating</strong> a vendor hides them from the search box on forms but keeps all past expenses.</li>
        </ul>
      </PageHelp>

      <VendorsTable
        vendors={vendors}
        categories={categories}
        locations={locations.filter((l) => l.active)}
        hiddenColumns={[...hiddenColumnsForPage(profile, "vendors")]}
        canMerge={profile.role === "owner" || profile.role === "co_owner"}
      />
    </div>
  );
}
