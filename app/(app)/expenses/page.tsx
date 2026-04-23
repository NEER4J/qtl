import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/require";
import { listExpenses } from "@/lib/actions/expenses";
import {
  listActiveExpenseCategories,
  listActiveExpenseSubcategories,
  listActiveLocations,
} from "@/lib/actions/reference";

import { ExpensesFilters } from "./expenses-filters";
import { ExpensesTable } from "./expenses-table";

export const dynamic = "force-dynamic";

export default async function ExpensesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
  if (profile.role === "employee") {
    return <div className="text-sm text-muted-foreground">You do not have access to expenses.</div>;
  }

  const params = await searchParams;
  const singleParams = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );

  const [result, locations, categories, subcategories] = await Promise.all([
    listExpenses(singleParams),
    listActiveLocations(),
    listActiveExpenseCategories(),
    listActiveExpenseSubcategories(),
  ]);

  const showLocationFilter = profile.role === "owner" || profile.role === "accountant";

  const canCreate =
    profile.role === "owner" ||
    profile.role === "accountant" ||
    profile.role === "manager" ||
    (profile.role === "staff" && profile.can_enter_expenses);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            {result.total.toLocaleString()} entr{result.total === 1 ? "y" : "ies"}
            {result.total > result.pageSize
              ? ` — page ${result.page} of ${Math.ceil(result.total / result.pageSize)}`
              : ""}
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/expenses/new">
              <Plus className="size-4" /> New expense
            </Link>
          </Button>
        )}
      </div>

      <ExpensesFilters
        initial={singleParams}
        locations={showLocationFilter ? locations : undefined}
        categories={categories}
        subcategories={subcategories}
      />

      <ExpensesTable
        rows={result.rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
      />
    </div>
  );
}
