import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listAllPartBrands } from "@/lib/actions/pricing";

import { PartBrandsTable } from "./part-brands-table";

export const dynamic = "force-dynamic";

export default async function PartBrandsPage() {
  await requireRole("owner");
  const brands = await listAllPartBrands();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Part brands</h1>
        <p className="text-sm text-muted-foreground">
          The brands that appear in the Brand dropdown on the Part form.
        </p>
      </div>

      <PageHelp id="settings-pricing-brands">
        <p>
          Use this page to keep the Brand dropdown tidy: seed values before you&apos;ve created any parts,
          rename to fix typos, or hide brands you no longer carry.
        </p>
        <ul>
          <li><strong>Rename</strong> cascades: every part with the old brand name is updated to the new one.</li>
          <li><strong>Deactivate</strong> removes the brand from the dropdown but keeps the text intact on existing parts.</li>
          <li>You can also add new brands on the fly from the Part form — they show up here automatically.</li>
        </ul>
      </PageHelp>

      <PartBrandsTable brands={brands} />
    </div>
  );
}
