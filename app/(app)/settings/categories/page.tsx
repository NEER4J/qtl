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
      <CategoriesManager categories={categories} subcategories={subcategories} />
    </div>
  );
}
