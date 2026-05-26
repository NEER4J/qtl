"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import {
  RecurringExpenseInput,
  UpdateRecurringExpenseInput,
} from "@/lib/schemas/recurring";
import type { RecurringExpense } from "@/lib/db/types";

export async function listRecurringExpenses(): Promise<RecurringExpense[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select("*")
    .order("active", { ascending: false })
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RecurringExpense[];
}

export const createRecurringExpense = wrapAction({
  schema: RecurringExpenseInput,
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<RecurringExpense> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("recurring_expenses")
      .insert({
        location_id: input.location_id,
        category_id: input.category_id,
        subcategory_id: input.subcategory_id || null,
        vendor_id: input.vendor_id || null,
        description: input.description || null,
        amount: input.amount,
        hst_rate: input.hst_rate,
        frequency: input.frequency,
        day_of_month: input.frequency === "weekly" ? null : input.day_of_month,
        day_of_week: input.frequency === "weekly" ? input.day_of_week : null,
        start_date: input.start_date,
        end_date: input.end_date || null,
        notes: input.notes || null,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/recurring-expenses");
    return data as RecurringExpense;
  },
});

export const updateRecurringExpense = wrapAction({
  schema: UpdateRecurringExpenseInput,
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<RecurringExpense> => {
    const supabase = await createClient();
    const { id, ...rest } = input;
    const { data, error } = await supabase
      .from("recurring_expenses")
      .update({
        location_id: rest.location_id,
        category_id: rest.category_id,
        subcategory_id: rest.subcategory_id || null,
        vendor_id: rest.vendor_id || null,
        description: rest.description || null,
        amount: rest.amount,
        hst_rate: rest.hst_rate,
        frequency: rest.frequency,
        day_of_month: rest.frequency === "weekly" ? null : rest.day_of_month,
        day_of_week: rest.frequency === "weekly" ? rest.day_of_week : null,
        start_date: rest.start_date,
        end_date: rest.end_date || null,
        notes: rest.notes || null,
        updated_by: profile.id,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/recurring-expenses");
    return data as RecurringExpense;
  },
});

export const toggleRecurringExpenseActive = wrapAction({
  schema: z.object({ id: z.string().uuid(), active: z.boolean() }),
  roles: ["owner", "co_owner", "manager"],
  handler: async (input, profile): Promise<RecurringExpense> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("recurring_expenses")
      .update({ active: input.active, updated_by: profile.id })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/recurring-expenses");
    return data as RecurringExpense;
  },
});

// Manually trigger the process function (normally would be on a cron).
export const processRecurringExpenses = wrapAction({
  schema: z.object({ as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  roles: ["owner", "co_owner", "manager"],
  handler: async (input): Promise<{ generated: number }> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("process_recurring_expenses", { as_of: input.as_of ?? null });
    if (error) throw error;
    revalidatePath("/expenses");
    revalidatePath("/settings/recurring-expenses");
    return { generated: (data as unknown[] | null)?.length ?? 0 };
  },
});
