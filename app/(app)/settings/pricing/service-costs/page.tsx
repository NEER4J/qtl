import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listAllServiceCosts } from "@/lib/actions/pricing";

import { ServiceCostsTable } from "./service-costs-table";

export const dynamic = "force-dynamic";

export default async function ServiceCostsPage() {
  await requireRole("owner", "co_owner");
  const serviceCosts = await listAllServiceCosts();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Service (labour) costs</h1>
        <p className="text-sm text-muted-foreground">
          Labour cost charged per installed filter type. Linked from parts and added into every oil-change price.
        </p>
      </div>

      <PageHelp id="settings-pricing-service-costs">
        <p>
          Each filter-type part (oil filter, fuel filter, air filter, etc.) can link to a service cost. When
          the oil-change price is computed, labour is added for every filter installed on that engine.
        </p>
        <ul>
          <li>Codes are uppercase identifiers (e.g. <code>OIL_FILTER</code>, <code>AIR_FILTER</code>, <code>AIR_DRYER</code>).</li>
          <li>Changing a cost recomputes every engine row that uses it on the oil-change grid.</li>
          <li>Deactivating a service cost hides it from the parts form but keeps historical links intact.</li>
        </ul>
      </PageHelp>

      <ServiceCostsTable serviceCosts={serviceCosts} />
    </div>
  );
}
