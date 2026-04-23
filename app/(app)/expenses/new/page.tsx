import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { requireProfile } from "@/lib/auth/require";
import {
  getAppSettings,
  listActiveExpenseCategories,
  listActiveExpenseSubcategories,
  listActiveLocations,
} from "@/lib/actions/reference";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const profile = await requireProfile();
  const canCreate =
    profile.role === "owner" ||
    profile.role === "accountant" ||
    profile.role === "manager" ||
    (profile.role === "staff" && profile.can_enter_expenses);
  if (!canCreate) redirect("/expenses");

  const [locations, categories, subcategories, settings] = await Promise.all([
    listActiveLocations(),
    listActiveExpenseCategories(),
    listActiveExpenseSubcategories(),
    getAppSettings(),
  ]);

  const lockedLocationId =
    profile.role === "staff" || profile.role === "manager"
      ? profile.location_id
      : null;

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/expenses">
            <ChevronLeft className="size-4" /> Back to expenses
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">New expense</h1>
        <p className="text-sm text-muted-foreground">
          Record a vendor bill. HST is calculated from the sub total.
        </p>
      </div>

      <ExpenseForm
        mode="create"
        locations={locations}
        categories={categories}
        subcategories={subcategories}
        hstRate={Number(settings.hst_rate)}
        lockedLocationId={lockedLocationId}
      />
    </div>
  );
}
