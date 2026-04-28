import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import {
  listAllParts,
  listAllServiceCosts,
  listPartBrands,
  listPartCategories,
} from "@/lib/actions/pricing";

import { PartsTable } from "./parts-table";

export const dynamic = "force-dynamic";

export default async function PartsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireRole("owner");
  const sp = await searchParams;

  const [parts, serviceCosts, categories, brands] = await Promise.all([
    listAllParts({ category_id: sp.category_id, brand: sp.brand, q: sp.q }),
    listAllServiceCosts(),
    listPartCategories(),
    listPartBrands(),
  ]);

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Parts catalogue</h1>
        <p className="text-sm text-muted-foreground">
          {parts.length} part{parts.length === 1 ? "" : "s"} {sp.q || sp.category_id || sp.brand ? "(filtered)" : "total"}
        </p>
      </div>

      <PageHelp id="settings-pricing-parts">
        <p>
          The filter catalogue — everything you sell on the counter. Each part has a cost (what you pay),
          an MHSW environmental fee, and a margin. The list price is calculated automatically.
        </p>
        <ul>
          <li><strong>Part # + brand</strong> is unique — a single brand won&apos;t have two rows with the same number.</li>
          <li><strong>List price</strong> = cost + MHSW fee + margin, and it appears on the filter price list that staff see.</li>
          <li><strong>Margin</strong> can be either a fixed dollar amount or a percent of the cost.</li>
          <li><strong>Service cost</strong> (optional) links this part to a labour charge. When the part is installed on an engine, that labour is added to the oil-change price automatically.</li>
          <li>Deactivate a part (never delete) — it stays on historical jobs but disappears from the price list.</li>
        </ul>
      </PageHelp>

      <PartsTable
        parts={parts}
        serviceCosts={serviceCosts}
        categories={categories}
        brands={brands}
        initialFilters={{ q: sp.q ?? "", category_id: sp.category_id ?? "", brand: sp.brand ?? "" }}
      />
    </div>
  );
}
