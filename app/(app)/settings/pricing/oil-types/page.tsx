import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listAllOilTypes } from "@/lib/actions/pricing";

import { OilTypesTable } from "./oil-types-table";

export const dynamic = "force-dynamic";

export default async function OilTypesPage() {
  await requireRole("owner", "co_owner");
  const oilTypes = await listAllOilTypes();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Oil types</h1>
        <p className="text-sm text-muted-foreground">
          The oil grades QTL sells, with bulk and gallon cost per litre.
        </p>
      </div>

      <PageHelp id="settings-pricing-oil-types">
        <p>
          Each oil type appears as a column on the oil-change grid. The two cost columns feed every
          price in that column; update a cost and every cell recalculates on the next load.
        </p>
        <ul>
          <li><strong>Bulk</strong> cost is what you pay per litre when buying in drum / tote.</li>
          <li><strong>Gallon</strong> cost is what you pay per litre when buying in packaged jugs.</li>
          <li>Mark exactly one oil type as <strong>base</strong> (typically 15W40). It&apos;s used for comparisons.</li>
          <li>Deactivating an oil type hides its column from the price grid but keeps history intact.</li>
          <li>Once you&apos;ve added an oil, go to <strong>Volume tiers</strong> to set its per-capacity premiums.</li>
        </ul>
      </PageHelp>

      <OilTypesTable oilTypes={oilTypes} />
    </div>
  );
}
