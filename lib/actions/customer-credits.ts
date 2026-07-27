"use server";

import { getCustomerCreditBalance } from "@/lib/actions/customer-credit-ledger";

/** Public wrapper for the sales form — fetches balance for the picker. */
export async function fetchCustomerCreditBalance(
  customerId: string,
  excludeJobId?: string,
): Promise<number> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  return getCustomerCreditBalance(supabase, customerId, excludeJobId);
}
