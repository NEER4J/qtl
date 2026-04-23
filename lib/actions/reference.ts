"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  AppSettings,
  ExpenseCategory,
  ExpenseSubcategory,
  Location,
  ServiceType,
} from "@/lib/db/types";

/**
 * Reference data — public to any authenticated user. These are small tables
 * (<100 rows each) and are read on every form page, so these helpers are
 * intentionally plain server functions without zod wrapping.
 */

export async function listActiveLocations(): Promise<Location[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Location[];
}

export async function listActiveServiceTypes(): Promise<ServiceType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_types")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as ServiceType[];
}

export async function listActiveExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as ExpenseCategory[];
}

export async function listActiveExpenseSubcategories(): Promise<ExpenseSubcategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_subcategories")
    .select("*")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as ExpenseSubcategory[];
}

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data as AppSettings;
}
