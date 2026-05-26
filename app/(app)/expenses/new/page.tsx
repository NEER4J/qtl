import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHelp } from "@/components/help/page-help";
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
    (profile.role === "owner" || profile.role === "co_owner") ||
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
    <div className="flex flex-col gap-4">
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

      <PageHelp id="expenses-new">
        <ul>
          <li><strong>Vendor</strong> — type to find an existing supplier. If they&apos;re new, just type their name and a vendor record is created when you save.</li>
          <li><strong>Invoice number</strong> — optional. Use whatever the vendor put on their bill.</li>
          <li><strong>Sub total / HST / Total</strong> — HST is calculated automatically at 13%. If the vendor charged a different tax amount, you can type over the HST box.</li>
          <li><strong>Amount paid and mode</strong> — leave at 0 if you haven&apos;t paid yet. The bill shows up on the outstanding-payables report until you come back and record the payment.</li>
        </ul>
      </PageHelp>

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
