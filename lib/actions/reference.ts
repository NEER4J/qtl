"use server";

import {
  getCachedActiveExpenseCategories,
  getCachedActiveExpenseSubcategories,
  getCachedActiveLocations,
  getCachedActiveServiceTypes,
  getCachedAppSettings,
} from "@/lib/cache/reference";
import type {
  AppSettings,
  ExpenseCategory,
  ExpenseSubcategory,
  Location,
  ServiceType,
} from "@/lib/db/types";

/**
 * Reference data — public to any authenticated user. These are small tables
 * (<100 rows each) and are read on every form page.
 *
 * They now resolve out of the cross-request cache in lib/cache/reference.ts
 * rather than hitting the database on every render; the signatures are
 * unchanged so callers do not care. Any action that writes one of these tables
 * must call revalidateReference() with the matching tag, or its edit stays
 * invisible for up to an hour.
 */

export async function listActiveLocations(): Promise<Location[]> {
  return (await getCachedActiveLocations()) as Location[];
}

export async function listActiveServiceTypes(): Promise<ServiceType[]> {
  return (await getCachedActiveServiceTypes()) as ServiceType[];
}

export async function listActiveExpenseCategories(): Promise<ExpenseCategory[]> {
  return (await getCachedActiveExpenseCategories()) as ExpenseCategory[];
}

export async function listActiveExpenseSubcategories(): Promise<ExpenseSubcategory[]> {
  return (await getCachedActiveExpenseSubcategories()) as ExpenseSubcategory[];
}

export async function getAppSettings(): Promise<AppSettings> {
  return (await getCachedAppSettings()) as AppSettings;
}
