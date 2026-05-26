import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listAllPartCategories } from "@/lib/actions/pricing";

import { PartCategoriesTable } from "./part-categories-table";

export const dynamic = "force-dynamic";

export default async function PartCategoriesPage() {
  await requireRole("owner", "co_owner");
  const categories = await listAllPartCategories();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Part categories</h1>
        <p className="text-sm text-muted-foreground">
          The categories that appear in the Category dropdown on the Part form.
        </p>
      </div>

      <PageHelp id="settings-pricing-categories">
        <p>
          Use this page to keep the Category dropdown tidy: seed values before you&apos;ve created any
          parts, rename to fix typos, or hide categories you no longer use.
        </p>
        <ul>
          <li><strong>Rename</strong> cascades: every part with the old category name is updated to the new one.</li>
          <li><strong>Deactivate</strong> removes the category from the dropdown but keeps the text intact on existing parts.</li>
          <li>You can also add new categories on the fly from the Part form — they show up here automatically.</li>
        </ul>
      </PageHelp>

      <PartCategoriesTable categories={categories} />
    </div>
  );
}
