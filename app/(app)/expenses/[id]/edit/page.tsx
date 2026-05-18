import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { requireProfile } from "@/lib/auth/require";
import { getExpense } from "@/lib/actions/expenses";
import {
  getAppSettings,
  listActiveExpenseCategories,
  listActiveExpenseSubcategories,
  listActiveLocations,
} from "@/lib/actions/reference";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const exp = await getExpense(id);
  if (!exp) notFound();

  const canEdit =
    profile.role === "owner" ||
    profile.role === "accountant" ||
    (profile.role === "manager" && profile.location_id === exp.location_id);
  if (!canEdit) redirect(`/expenses/${id}`);
  if (exp.deactivated_at) redirect(`/expenses/${id}`);

  const [locations, categories, subcategories, settings] = await Promise.all([
    listActiveLocations(),
    listActiveExpenseCategories(),
    listActiveExpenseSubcategories(),
    getAppSettings(),
  ]);

  return (
    <div className="flex flex-col gap-4 mx-auto">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href={`/expenses/${exp.id}`}>
            <ChevronLeft className="size-4" /> Back to expense
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">
          Edit {exp.category_name}
          {exp.invoice_no ? ` · #${exp.invoice_no}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Created {formatDate(exp.created_at)}
        </p>
      </div>

      <ExpenseForm
        mode="edit"
        locations={locations}
        categories={categories}
        subcategories={subcategories}
        hstRate={Number(settings.hst_rate)}
        initial={{
          id: exp.id,
          location_id: exp.location_id,
          expense_date: exp.expense_date,
          category_id: exp.category_id,
          subcategory_id: exp.subcategory_id,
          vendor_id: exp.vendor_id,
          vendor_name_snapshot: exp.vendor_name_snapshot ?? exp.vendor_name ?? "",
          invoice_no: exp.invoice_no ?? "",
          account_type: exp.account_type ?? "",
          account_number: exp.account_number ?? "",
          contact_no: exp.contact_no ?? "",
          email: exp.email ?? "",
          sub_total: exp.sub_total.toString(),
          hst: exp.hst.toString(),
          total: exp.total.toString(),
          paid_amount: exp.paid_amount.toString(),
          payment_date: exp.payment_date ?? "",
          payment_mode: exp.payment_mode ?? "",
          transaction_id: exp.transaction_id ?? "",
          notes: exp.notes ?? "",
        }}
        initialItems={exp.items.map((it) => ({
          client_id: it.id,
          id: it.id,
          part_id: it.part_id,
          vendor_part_id: it.vendor_part_id,
          description: it.description,
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost),
          last_buying_price:
            it.last_buying_price_snapshot != null
              ? Number(it.last_buying_price_snapshot)
              : null,
        }))}
      />
    </div>
  );
}
