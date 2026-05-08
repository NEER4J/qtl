"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  AddExpensePaymentInput,
  DeactivateExpenseInput,
  ExpenseInput,
  ListExpensesInput,
  UpdateExpenseInput,
} from "@/lib/schemas/expenses";
import type { Expense, ExpenseItem, PaymentMode, PaymentStatus } from "@/lib/db/types";

// ----------------------------------------------------------------------------
// List
// ----------------------------------------------------------------------------
export interface ExpenseRow extends Expense {
  location_code: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  vendor_name: string | null;
}

export interface ListExpensesResult {
  rows: ExpenseRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listExpenses(
  raw: Partial<Record<string, string | number>> = {},
): Promise<ListExpensesResult> {
  const input = ListExpensesInput.parse(raw);
  const supabase = await createClient();

  const from = (input.page - 1) * input.pageSize;
  const to = from + input.pageSize - 1;

  let query = supabase
    .from("expenses")
    .select(
      "*, locations:location_id(code), expense_categories:category_id(name), expense_subcategories:subcategory_id(name), vendors:vendor_id(name)",
      { count: "exact" },
    )
    .is("deactivated_at", null)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (input.from) query = query.gte("expense_date", input.from);
  if (input.to) query = query.lte("expense_date", input.to);
  if (input.location_id) query = query.eq("location_id", input.location_id);
  if (input.category_id) query = query.eq("category_id", input.category_id);
  if (input.subcategory_id) query = query.eq("subcategory_id", input.subcategory_id);
  if (input.vendor_id) query = query.eq("vendor_id", input.vendor_id);
  if (input.payment_status) query = query.eq("payment_status", input.payment_status);
  if (input.q) {
    const term = `%${input.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    query = query.or(`invoice_no.ilike.${term},vendor_name_snapshot.ilike.${term}`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  type JoinedRow = Expense & {
    locations: { code: string | null } | { code: string | null }[] | null;
    expense_categories: { name: string | null } | { name: string | null }[] | null;
    expense_subcategories: { name: string | null } | { name: string | null }[] | null;
    vendors: { name: string | null } | { name: string | null }[] | null;
  };

  const rows: ExpenseRow[] = (data as JoinedRow[] | null ?? []).map((r) => {
    const loc = Array.isArray(r.locations) ? r.locations[0] : r.locations;
    const cat = Array.isArray(r.expense_categories) ? r.expense_categories[0] : r.expense_categories;
    const sub = Array.isArray(r.expense_subcategories) ? r.expense_subcategories[0] : r.expense_subcategories;
    const ven = Array.isArray(r.vendors) ? r.vendors[0] : r.vendors;
    const {
      locations: _l,
      expense_categories: _c,
      expense_subcategories: _s,
      vendors: _v,
      ...rest
    } = r;
    void _l; void _c; void _s; void _v;
    return {
      ...(rest as Expense),
      location_code: loc?.code ?? null,
      category_name: cat?.name ?? null,
      subcategory_name: sub?.name ?? null,
      vendor_name: ven?.name ?? null,
    };
  });

  return { rows, total: count ?? 0, page: input.page, pageSize: input.pageSize };
}

// ----------------------------------------------------------------------------
// Get one
// ----------------------------------------------------------------------------
export interface ExpensePaymentRow {
  id: string;
  paid_on: string;
  amount: number;
  mode: PaymentMode;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ExpenseDetail extends Expense {
  location_name: string | null;
  location_code: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  vendor_name: string | null;
  payments: ExpensePaymentRow[];
  items: ExpenseItem[];
}

export async function getExpense(id: string): Promise<ExpenseDetail | null> {
  const supabase = await createClient();
  const [
    { data: exp, error: expErr },
    { data: payments, error: payErr },
    { data: items, error: itemsErr },
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "*, locations:location_id(code, name), expense_categories:category_id(name), expense_subcategories:subcategory_id(name), vendors:vendor_id(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("expense_payments")
      .select("*")
      .eq("expense_id", id)
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("expense_items")
      .select("*")
      .eq("expense_id", id)
      .order("position"),
  ]);

  if (expErr) throw expErr;
  if (payErr) throw payErr;
  if (itemsErr) throw itemsErr;
  if (!exp) return null;

  type JoinedRow = Expense & {
    locations: { code: string | null; name: string | null } | { code: string | null; name: string | null }[] | null;
    expense_categories: { name: string | null } | { name: string | null }[] | null;
    expense_subcategories: { name: string | null } | { name: string | null }[] | null;
    vendors: { name: string | null } | { name: string | null }[] | null;
  };
  const e = exp as JoinedRow;
  const loc = Array.isArray(e.locations) ? e.locations[0] : e.locations;
  const cat = Array.isArray(e.expense_categories) ? e.expense_categories[0] : e.expense_categories;
  const sub = Array.isArray(e.expense_subcategories) ? e.expense_subcategories[0] : e.expense_subcategories;
  const ven = Array.isArray(e.vendors) ? e.vendors[0] : e.vendors;
  const {
    locations: _l,
    expense_categories: _c,
    expense_subcategories: _s,
    vendors: _v,
    ...rest
  } = e;
  void _l; void _c; void _s; void _v;

  return {
    ...(rest as Expense),
    location_code: loc?.code ?? null,
    location_name: loc?.name ?? null,
    category_name: cat?.name ?? null,
    subcategory_name: sub?.name ?? null,
    vendor_name: ven?.name ?? null,
    payments: (payments ?? []) as ExpensePaymentRow[],
    items: (items ?? []) as ExpenseItem[],
  };
}

// Replace-all approach matches sales_job_items: easier than diffing for the
// volumes seen here (typically <30 lines per expense). Wrapping in a single
// supabase call keeps the latency low.
async function replaceExpenseItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  expenseId: string,
  items: Array<{
    part_id?: string | null;
    vendor_part_id?: string | null;
    description: string;
    quantity: number;
    unit_cost: number;
  }>,
  actorId: string,
): Promise<void> {
  const { error: delErr } = await supabase
    .from("expense_items")
    .delete()
    .eq("expense_id", expenseId);
  if (delErr) throw delErr;
  if (items.length === 0) return;
  const rows = items.map((it, i) => ({
    expense_id: expenseId,
    part_id: it.part_id ?? null,
    vendor_part_id: it.vendor_part_id ?? null,
    description: it.description,
    quantity: it.quantity,
    unit_cost: it.unit_cost,
    position: i,
    created_by: actorId,
  }));
  const { error: insErr } = await supabase.from("expense_items").insert(rows);
  if (insErr) throw insErr;
}

// ----------------------------------------------------------------------------
// Create
// ----------------------------------------------------------------------------
export const createExpense = wrapAction({
  schema: ExpenseInput,
  roles: ["owner", "accountant", "manager", "staff"],
  handler: async (input, profile): Promise<Expense> => {
    const locationId =
      profile.role === "staff"
        ? profile.location_id ?? input.location_id
        : input.location_id;

    const supabase = await createClient();
    const status = deriveStatus(input.total, input.paid_amount);

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        location_id: locationId,
        expense_date: input.expense_date,
        category_id: input.category_id,
        subcategory_id: input.subcategory_id ?? null,
        vendor_id: input.vendor_id ?? null,
        vendor_name_snapshot: input.vendor_name_snapshot || null,
        invoice_no: input.invoice_no || null,
        account_type: input.account_type || null,
        account_number: input.account_number || null,
        contact_no: input.contact_no || null,
        email: input.email || null,
        sub_total: input.sub_total,
        hst: input.hst,
        total: input.total,
        paid_amount: input.paid_amount,
        payment_date: input.payment_date || null,
        payment_mode: input.payment_mode ?? null,
        transaction_id: input.transaction_id || null,
        payment_status: status,
        notes: input.notes || null,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("*")
      .single();
    if (error) throw error;

    // Mirror initial paid amount into an expense_payments row so history is
    // consistent with future partial payments.
    if (input.paid_amount > 0 && input.payment_mode) {
      const { error: payErr } = await supabase.from("expense_payments").insert({
        expense_id: data.id,
        paid_on: input.payment_date || input.expense_date,
        amount: input.paid_amount,
        mode: input.payment_mode,
        transaction_id: input.transaction_id || null,
        created_by: profile.id,
      });
      if (payErr) throw payErr;
    }

    // Item #24 — persist the parts billed on this expense.
    await replaceExpenseItems(supabase, data.id, input.items ?? [], profile.id);

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return data as Expense;
  },
});

// ----------------------------------------------------------------------------
// Update
// ----------------------------------------------------------------------------
export const updateExpense = wrapAction({
  schema: UpdateExpenseInput,
  roles: ["owner", "accountant", "manager"],
  handler: async (input, profile): Promise<Expense> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expenses")
      .update({
        location_id: input.location_id,
        expense_date: input.expense_date,
        category_id: input.category_id,
        subcategory_id: input.subcategory_id ?? null,
        vendor_id: input.vendor_id ?? null,
        vendor_name_snapshot: input.vendor_name_snapshot || null,
        invoice_no: input.invoice_no || null,
        account_type: input.account_type || null,
        account_number: input.account_number || null,
        contact_no: input.contact_no || null,
        email: input.email || null,
        sub_total: input.sub_total,
        hst: input.hst,
        total: input.total,
        payment_date: input.payment_date || null,
        payment_mode: input.payment_mode ?? null,
        transaction_id: input.transaction_id || null,
        notes: input.notes || null,
        updated_by: profile.id,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;

    // Item #24 — replace-all line items.
    await replaceExpenseItems(supabase, input.id, input.items ?? [], profile.id);

    revalidatePath("/expenses");
    revalidatePath(`/expenses/${input.id}`);
    revalidatePath("/dashboard");
    return data as Expense;
  },
});

// ----------------------------------------------------------------------------
// Add partial payment
// ----------------------------------------------------------------------------
export const addExpensePayment = wrapAction({
  schema: AddExpensePaymentInput,
  roles: ["owner", "accountant", "manager"],
  handler: async (input, profile): Promise<ExpensePaymentRow> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expense_payments")
      .insert({
        expense_id: input.expense_id,
        paid_on: input.paid_on,
        amount: input.amount,
        mode: input.mode,
        transaction_id: input.transaction_id || null,
        notes: input.notes || null,
        created_by: profile.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(`/expenses/${input.expense_id}`);
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return data as ExpensePaymentRow;
  },
});

// ----------------------------------------------------------------------------
// Deactivate (owner only)
// ----------------------------------------------------------------------------
export const deactivateExpense = wrapAction({
  schema: DeactivateExpenseInput,
  roles: ["owner"],
  handler: async (input, profile): Promise<{ id: string }> => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("expenses")
      .update({
        deactivated_at: new Date().toISOString(),
        deactivated_by: profile.id,
        updated_by: profile.id,
      })
      .eq("id", input.id);
    if (error) throw error;
    revalidatePath("/expenses");
    return { id: input.id };
  },
});

function deriveStatus(total: number, paid: number): PaymentStatus {
  if (paid <= 0) return "outstanding";
  if (paid < total) return "partial";
  return "paid";
}
