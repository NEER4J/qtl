import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import {
  listAllExpenseCategories,
  listAllExpenseSubcategories,
} from "@/lib/actions/categories";

import { CategoriesManager } from "./categories-manager";

export const dynamic = "force-dynamic";

export default async function SettingsCategoriesPage() {
  await requireRole("owner");
  const [categories, subcategories] = await Promise.all([
    listAllExpenseCategories(),
    listAllExpenseSubcategories(),
  ]);

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Expense categories</h1>
        <p className="text-sm text-muted-foreground">
          Manage categories and subcategories used when creating expenses.
        </p>
      </div>
      <PageHelp id="settings-categories">
        <p>
          Two-level tags for expenses. Every expense needs a category; a sub-category is optional but makes the reports more useful.
        </p>
        <ul>
          <li>Start with the eight standard categories: Advertisement, Cleaning, Repair, Utility, Miscellaneous, Bank, Purchase, Office. Add more as you need them.</li>
          <li>Each sub-category belongs to a specific category — pick the parent when you create it.</li>
          <li>Deactivating a category hides it from the expense form but keeps any past expenses tagged with it.</li>
          <li>Drag the handles to reorder the way they appear in the expense form.</li>
        </ul>
      </PageHelp>

      <CategoriesManager categories={categories} subcategories={subcategories} />
    </div>
  );
}
