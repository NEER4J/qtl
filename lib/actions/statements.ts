"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRowsParallel } from "@/lib/supabase/fetch-all";
import { AuthorizationError, requireProfile } from "@/lib/auth/require";
import { accessibleLocationIds } from "@/lib/auth/locations";
import { listActiveLocations } from "@/lib/actions/reference";
import { isPageAllowed } from "@/lib/permissions/check";
import { pageKeyForRequestPath } from "@/lib/permissions/registry";
import {
  MONTH_RE,
  buildStatementFigures,
  type StatementFigures,
  type StatementJobInput,
  type StatementLedgerInput,
} from "@/lib/utils/statement";
import { todayISO } from "@/lib/utils/tz";
import type { Customer } from "@/lib/db/types";

// ============================================================================
// Monthly customer statement (client 2026-10-20) — one page per customer per
// month: opening balance, the month's invoices and payments, store credit,
// closing balance. Printed, downloaded and emailed like an invoice. The
// arithmetic lives in lib/utils/statement.ts.
// ============================================================================

export interface CustomerMonthlyStatement extends StatementFigures {
  customer: {
    id: string;
    name: string;
    code: string | null;
    address_lines: string[];
    email: string | null;
    phone: string | null;
  };
  /** The shop the statement comes from (letterhead). */
  shop: {
    /** The location ("Ayr"), as the invoice letterhead prints it. */
    name: string;
    /** "Quick Truck Lube" — the invoice name, for the email signature. */
    business_name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    gst: string | null;
  };
  /** Ontario date it was produced. */
  generated_on: string;
  /**
   * Set when the viewer can't see every shop: invoices are read with their
   * access, so only these shops' invoices are on it and the balances may be
   * short. Null for an all-shops user.
   */
  shops_only: string[] | null;
}

/** Same gate as the page: API routes and actions sit outside the layout's. */
async function requireStatementAccess() {
  const profile = await requireProfile();
  const key = pageKeyForRequestPath("/reports/customer-statement") ?? "reports";
  if (!isPageAllowed(profile, key)) {
    throw new AuthorizationError("You don't have access to customer statements.");
  }
  return profile;
}

function addressLines(c: Customer): string[] {
  // A statement goes in the mail, so the mailing address wins when there is one.
  const mailing = !!c.mailing_address_1?.trim();
  const l1 = mailing ? c.mailing_address_1 : c.address_1;
  const l2 = mailing ? c.mailing_address_2 : c.address_2;
  const city = mailing ? c.mailing_city : c.city;
  const prov = mailing ? c.mailing_province : c.province;
  const postal = mailing ? c.mailing_postal_code : c.postal_code;
  const cityLine = [[city, prov].filter(Boolean).join(", "), postal].filter(Boolean).join("  ");
  return [l1, l2, cityLine].map((s) => s?.trim() ?? "").filter(Boolean);
}

export async function getCustomerMonthlyStatement(
  customerId: string,
  month: string,
): Promise<CustomerMonthlyStatement | null> {
  const profile = await requireStatementAccess();
  if (!MONTH_RE.test(month)) throw new Error("Month must be YYYY-MM.");
  const supabase = await createClient();

  type JobRow = Omit<StatementJobInput, "payments"> & {
    sales_payments: StatementJobInput["payments"];
  };
  type LedgerRow = Omit<StatementLedgerInput, "job"> & {
    sales_jobs: StatementLedgerInput["job"] | StatementLedgerInput["job"][];
  };

  // Every invoice the customer has, not just the month's: the opening
  // balance is everything still owing from before it. Paged — a fleet
  // account can pass the 1,000-row cap.
  const [custRes, jobRows, ledgerRows, locations] = await Promise.all([
    supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
    fetchAllRowsParallel<JobRow>((lo, hi, count) =>
      supabase
        .from("sales_jobs")
        .select(
          `id, job_date, invoice_no, total, credit_applied, paid_amount, payment_mode,
           license_plate, unit_no, location_id,
           sales_payments(id, paid_on, amount, mode, transaction_id, notes, created_at)`,
          { count },
        )
        .eq("customer_id", customerId)
        .is("deactivated_at", null)
        .order("job_date")
        .order("id")
        .range(lo, hi),
    ),
    fetchAllRowsParallel<LedgerRow>((lo, hi, count) =>
      supabase
        .from("customer_credit_ledger")
        .select(
          "id, amount, notes, created_at, sales_job_id, sales_jobs:sales_job_id(job_date, invoice_no, total, deactivated_at)",
          { count },
        )
        .eq("customer_id", customerId)
        .order("created_at")
        .order("id")
        .range(lo, hi),
    ),
    listActiveLocations(),
  ]);
  if (custRes.error) throw custRes.error;
  const customer = custRes.data as Customer | null;
  if (!customer) return null;

  const figures = buildStatementFigures({
    month,
    jobs: jobRows.map(({ sales_payments, ...j }) => ({ ...j, payments: sales_payments })),
    ledger: ledgerRows.map(({ sales_jobs, ...l }) => ({
      ...l,
      job: Array.isArray(sales_jobs) ? (sales_jobs[0] ?? null) : sales_jobs,
    })),
  });

  // Letterhead: the customer's home shop, else where they were last served,
  // else the user's own.
  const lastJobLocation = [...jobRows].reverse().find((j) => j.location_id)?.location_id;
  const shopLoc =
    locations.find((l) => l.id === customer.home_location_id) ??
    locations.find((l) => l.id === lastJobLocation) ??
    locations.find((l) => l.id === profile.location_id) ??
    locations[0];

  const scope = accessibleLocationIds(profile);
  const shopsOnly = scope
    ? locations.filter((l) => scope.includes(l.id)).map((l) => l.name || l.invoice_name || "Your shop")
    : null;

  return {
    ...figures,
    customer: {
      id: customer.id,
      name: customer.billing_name ?? customer.last_or_company ?? "(no name)",
      code: customer.code,
      address_lines: addressLines(customer),
      email: customer.email,
      phone: customer.phone_business || customer.contact_no || customer.phone_cell || null,
    },
    shop: {
      name: shopLoc?.name || shopLoc?.invoice_name || "Quick Truck Lube",
      business_name: shopLoc?.invoice_name || "Quick Truck Lube",
      address: shopLoc?.address ?? null,
      phone: shopLoc?.phone ?? null,
      email: shopLoc?.email ?? null,
      // The business number alone — "RT 001" is the account suffix (as on the invoice).
      gst: shopLoc?.hst_number?.replace(/\s*RT\s*\d+\s*$/i, "") || null,
    },
    generated_on: todayISO(),
    shops_only: shopsOnly,
  };
}

/** Days an emailed statement link stays open (same as an invoice). */
const SHARE_LINK_DAYS = 30;

/**
 * A link to put in a statement email. The customer isn't signed in to QTL, so
 * it is the PDF stored next to the invoices (under statements/), signed for
 * 30 days and rendered fresh so it matches the account as it is now.
 */
export async function getStatementShareLink(
  customerId: string,
  month: string,
): Promise<{ url: string; days: number }> {
  const statement = await getCustomerMonthlyStatement(customerId, month);
  if (!statement) throw new Error("Customer not found.");

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { buildStatementDoc } = await import("@/components/pdf/StatementPdf");
  const buffer = await renderToBuffer(buildStatementDoc(statement));

  const admin = createAdminClient();
  const storagePath = `statements/${customerId}/${month}.pdf`;
  const { error: uploadErr } = await admin.storage
    .from("invoices")
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadErr) throw uploadErr;

  const { data: signed, error } = await admin.storage
    .from("invoices")
    .createSignedUrl(storagePath, SHARE_LINK_DAYS * 24 * 60 * 60);
  if (error || !signed) throw error ?? new Error("Couldn't make a link to the statement.");
  return { url: signed.signedUrl, days: SHARE_LINK_DAYS };
}
