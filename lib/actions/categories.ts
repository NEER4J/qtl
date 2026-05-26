"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { wrapAction } from "@/lib/actions/_utils";
import type { ExpenseCategory, ExpenseSubcategory } from "@/lib/db/types";

// ─── Categories ─────────────────────────────────────────────────────────────

export async function listAllExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as ExpenseCategory[];
}

export async function listAllExpenseSubcategories(): Promise<ExpenseSubcategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_subcategories")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as ExpenseSubcategory[];
}

const CategoryInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  sort_order: z.coerce.number().int().min(0).default(0),
});
const UpdateCategoryInput = CategoryInput.extend({ id: z.string().uuid() });

export const createExpenseCategory = wrapAction({
  schema: CategoryInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<ExpenseCategory> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expense_categories")
      .insert({ name: input.name, sort_order: input.sort_order })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/categories");
    return data as ExpenseCategory;
  },
});

export const updateExpenseCategory = wrapAction({
  schema: UpdateCategoryInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<ExpenseCategory> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expense_categories")
      .update({ name: input.name, sort_order: input.sort_order })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/categories");
    return data as ExpenseCategory;
  },
});

export const toggleCategoryActive = wrapAction({
  schema: z.object({ id: z.string().uuid(), active: z.boolean() }),
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<ExpenseCategory> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expense_categories")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/categories");
    return data as ExpenseCategory;
  },
});

// ─── Subcategories ───────────────────────────────────────────────────────────

const SubcategoryInput = z.object({
  category_id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(100),
  sort_order: z.coerce.number().int().min(0).default(0),
});
const UpdateSubcategoryInput = SubcategoryInput.extend({ id: z.string().uuid() });

export const createExpenseSubcategory = wrapAction({
  schema: SubcategoryInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<ExpenseSubcategory> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expense_subcategories")
      .insert({ category_id: input.category_id, name: input.name, sort_order: input.sort_order })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/categories");
    return data as ExpenseSubcategory;
  },
});

export const updateExpenseSubcategory = wrapAction({
  schema: UpdateSubcategoryInput,
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<ExpenseSubcategory> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expense_subcategories")
      .update({ category_id: input.category_id, name: input.name, sort_order: input.sort_order })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/categories");
    return data as ExpenseSubcategory;
  },
});

export const toggleSubcategoryActive = wrapAction({
  schema: z.object({ id: z.string().uuid(), active: z.boolean() }),
  roles: ["owner", "co_owner"],
  handler: async (input): Promise<ExpenseSubcategory> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("expense_subcategories")
      .update({ active: input.active })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath("/settings/categories");
    return data as ExpenseSubcategory;
  },
});
