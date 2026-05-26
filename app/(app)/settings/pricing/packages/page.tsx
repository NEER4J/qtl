import { PageHelp } from "@/components/help/page-help";
import { requireProfile, requireRole } from "@/lib/auth/require";
import { listAllPartPackages } from "@/lib/actions/pricing";

import { PartPackagesTable } from "./part-packages-table";

export const dynamic = "force-dynamic";

export default async function PartPackagesPage() {
  await requireRole("owner", "co_owner");
  const profile = await requireProfile();
  const packages = await listAllPartPackages();
  const isOwner = (profile.role === "owner" || profile.role === "co_owner");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Packages</h1>
        <p className="text-sm text-muted-foreground">
          Pre-defined bundles of parts you can add to a sales job in one click.
        </p>
      </div>

      <PageHelp id="settings-pricing-packages">
        <p>
          A package is a saved list of parts with default quantities (e.g. <em>Standard Oil
          Change</em> = 1× oil filter + 5× 5W30 + 1× drain plug washer). On the sales-job form
          the <strong>Add package</strong> button drops every part in a package onto the line
          items in one click — each line is then independently editable.
        </p>
        <ul>
          <li>Unit price is pulled from the parts catalogue when the package is added, so list-price changes flow through automatically.</li>
          <li>Deactivate a package to remove it from the picker without losing it.</li>
          <li>Each part can only appear once per package — change the quantity instead of adding it twice.</li>
        </ul>
      </PageHelp>

      <PartPackagesTable packages={packages} isOwner={isOwner} />
    </div>
  );
}
