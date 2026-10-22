/**
 * Monthly customer statement — the arithmetic (client 2026-10-20). Pure, so
 * the server action, the PDF and a reconciliation script all agree.
 *
 * The model, per invoice (non-deactivated sales_jobs row):
 *   due      = total − store credit applied, never below 0. A return invoice
 *              (negative total) owes nothing; its value is store credit, which
 *              the ledger carries (syncJobCreditLedger), so it is shown there.
 *   tenders  = its sales_payments rows (legacy jobs: paid_amount on the job
 *              date — lib/utils/job-tenders.ts).
 *   applied  = tenders received so far, capped at `due`. Anything beyond is an
 *              overpayment, which became store credit (migration 0127).
 *   owing    = due − applied.
 * A payment dated before its invoice (a deposit, or a back-dated entry) counts
 * from the invoice date, so it can't fall into a month the invoice isn't in.
 *
 * Opening balance = owing at the first of the month on invoices dated before
 * it; closing = owing at the first of next month. They always reconcile:
 *   closing = opening + invoices − credit applied − payments + overpayment.
 */
import { jobTenders, type PaymentRowLike, type Tender } from "@/lib/utils/job-tenders";
import { toISODate } from "@/lib/utils/tz";

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface StatementJobInput {
  id: string;
  job_date: string;
  invoice_no: string;
  total: number | string;
  credit_applied: number | string | null;
  paid_amount: number | string;
  payment_mode: string | null;
  license_plate: string | null;
  unit_no: string | null;
  location_id: string | null;
  payments: PaymentRowLike[] | null;
}

export interface StatementLedgerInput {
  id: string;
  amount: number | string;
  notes: string | null;
  created_at: string;
  sales_job_id: string | null;
  /** The linked invoice, deactivated or not. */
  job: {
    job_date: string;
    invoice_no: string;
    total: number | string;
    deactivated_at: string | null;
  } | null;
}

export interface StatementInvoiceLine {
  id: string;
  job_date: string;
  invoice_no: string;
  plate: string | null;
  unit_no: string | null;
  total: number;
  credit_applied: number;
  /** Payments applied by the end of the month. */
  paid: number;
  /** Still owing at the end of the month. */
  owing: number;
}

export interface StatementPaymentLine {
  key: string;
  paid_on: string;
  mode: string | null;
  reference: string | null;
  notes: string | null;
  job_id: string;
  invoice_no: string;
  amount: number;
  legacy: boolean;
}

export interface StatementCreditLine {
  id: string;
  date: string;
  description: string;
  invoice_no: string | null;
  amount: number;
}

export interface StatementFigures {
  month: string;
  /** First day of the month and the first day of the next (exclusive). */
  start: string;
  next: string;
  /** Last day of the month — the statement date. */
  end: string;
  opening_balance: number;
  invoices_total: number;
  credit_applied_total: number;
  payments_total: number;
  /** Part of this month's payments that went past what was owed → store credit. */
  overpayment_to_credit: number;
  closing_balance: number;
  /** Owing on every invoice right now, payments after the month included. */
  balance_today: number;
  invoices: StatementInvoiceLine[];
  payments: StatementPaymentLine[];
  /** Invoices from before the month still owing at its end. */
  earlier_owing: StatementInvoiceLine[];
  store_credit: {
    opening: number;
    closing: number;
    available_now: number;
    lines: StatementCreditLine[];
  };
}

const cents = (v: number | string | null | undefined) => Math.round(Number(v ?? 0) * 100);
const dollars = (c: number) => c / 100;

export function monthBounds(month: string): { start: string; next: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const nextDate = new Date(Date.UTC(y, m, 1));
  const next = nextDate.toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, next, end };
}

/** "September 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/** The last full month before `today` (YYYY-MM-DD), as YYYY-MM. */
export function previousMonth(today: string): string {
  const [y, m] = today.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

interface PreparedJob {
  job: StatementJobInput;
  due: number; // cents
  /** Tenders with the date they count from, oldest first. */
  tenders: (Tender & { effective: string })[];
}

/** Cents applied to the invoice by payments counted before `before`. */
function appliedBefore(p: PreparedJob, before: string | null): number {
  let sum = 0;
  for (const t of p.tenders) {
    if (before && t.effective >= before) break;
    sum += cents(t.amount);
  }
  return Math.min(sum, p.due);
}

export function buildStatementFigures(input: {
  month: string;
  jobs: readonly StatementJobInput[];
  ledger: readonly StatementLedgerInput[];
}): StatementFigures {
  const { month } = input;
  const { start, next, end } = monthBounds(month);

  const prepared: PreparedJob[] = input.jobs.map((job) => {
    const due = Math.max(0, cents(job.total) - cents(job.credit_applied));
    const tenders = jobTenders(
      { job_date: job.job_date, paid_amount: job.paid_amount, payment_mode: job.payment_mode },
      job.payments,
    )
      .map((t) => ({ ...t, effective: t.paid_on < job.job_date ? job.job_date : t.paid_on }))
      .sort((a, b) => a.effective.localeCompare(b.effective) || (a.created_at ?? "").localeCompare(b.created_at ?? ""));
    return { job, due, tenders };
  });

  const line = (p: PreparedJob, at: string): StatementInvoiceLine => {
    const applied = appliedBefore(p, at);
    return {
      id: p.job.id,
      job_date: p.job.job_date,
      invoice_no: p.job.invoice_no,
      plate: p.job.license_plate,
      unit_no: p.job.unit_no,
      total: dollars(cents(p.job.total)),
      credit_applied: dollars(cents(p.job.credit_applied)),
      paid: dollars(applied),
      owing: dollars(p.due - applied),
    };
  };

  let opening = 0;
  let closing = 0;
  let today = 0;
  let invoicesTotal = 0;
  let creditApplied = 0;
  let paymentsTotal = 0;
  let appliedInMonth = 0;
  const invoices: StatementInvoiceLine[] = [];
  const earlier: StatementInvoiceLine[] = [];
  const payments: StatementPaymentLine[] = [];

  for (const p of prepared) {
    const d = p.job.job_date;
    today += p.due - appliedBefore(p, null);
    if (d >= next) continue;

    const appliedAtNext = appliedBefore(p, next);
    closing += p.due - appliedAtNext;
    if (d < start) {
      const appliedAtStart = appliedBefore(p, start);
      opening += p.due - appliedAtStart;
      appliedInMonth += appliedAtNext - appliedAtStart;
      if (p.due - appliedAtNext > 0) earlier.push(line(p, next));
    } else {
      appliedInMonth += appliedAtNext;
      // Returns (negative totals) are store credit — listed under it, not here.
      // $0 invoices (free / warranty work) are listed; they owe nothing.
      if (cents(p.job.total) >= 0) {
        invoicesTotal += cents(p.job.total);
        creditApplied += cents(p.job.credit_applied);
        invoices.push(line(p, next));
      }
    }

    for (const t of p.tenders) {
      if (t.effective < start || t.effective >= next) continue;
      paymentsTotal += cents(t.amount);
      payments.push({
        key: t.id ?? `legacy-${p.job.id}`,
        paid_on: t.paid_on,
        mode: t.mode,
        reference: t.transaction_id,
        notes: t.notes,
        job_id: p.job.id,
        invoice_no: p.job.invoice_no,
        amount: t.amount,
        legacy: t.legacy,
      });
    }
  }

  // --- Store credit. Ledger rows are rewritten whenever an invoice is edited,
  // so created_at can be months after the fact; date each movement by what
  // caused it instead: the invoice date for credit issued on a return or
  // applied to an invoice, the last payment for an overpayment, and the
  // entry's own date for anything else (manual entries, deactivation reversals).
  const lastTender = new Map<string, string>();
  for (const p of prepared) {
    const t = p.tenders[p.tenders.length - 1];
    if (t) lastTender.set(p.job.id, t.effective);
  }
  const creditLines: StatementCreditLine[] = [];
  let creditOpening = 0;
  let creditClosing = 0;
  let creditNow = 0;
  for (const row of input.ledger) {
    const amount = cents(row.amount);
    const job = row.job;
    let date: string;
    if (job && !job.deactivated_at) {
      const overpayment = amount > 0 && cents(job.total) > 0;
      date = overpayment
        ? (lastTender.get(row.sales_job_id ?? "") ?? job.job_date)
        : job.job_date;
    } else {
      date = toISODate(new Date(row.created_at));
    }
    creditNow += amount;
    if (date < start) creditOpening += amount;
    if (date < next) creditClosing += amount;
    if (date >= start && date < next) {
      creditLines.push({
        id: row.id,
        date,
        description: row.notes?.trim() || (amount > 0 ? "Store credit added" : "Store credit used"),
        invoice_no: job?.invoice_no ?? null,
        amount: dollars(amount),
      });
    }
  }

  const byInvoiceDate = (a: StatementInvoiceLine, b: StatementInvoiceLine) =>
    a.job_date.localeCompare(b.job_date) || a.invoice_no.localeCompare(b.invoice_no);

  return {
    month,
    start,
    next,
    end,
    opening_balance: dollars(opening),
    invoices_total: dollars(invoicesTotal),
    credit_applied_total: dollars(creditApplied),
    payments_total: dollars(paymentsTotal),
    overpayment_to_credit: dollars(paymentsTotal - appliedInMonth),
    closing_balance: dollars(closing),
    balance_today: dollars(today),
    invoices: invoices.sort(byInvoiceDate),
    payments: payments.sort(
      (a, b) => a.paid_on.localeCompare(b.paid_on) || a.invoice_no.localeCompare(b.invoice_no),
    ),
    earlier_owing: earlier.sort(byInvoiceDate),
    store_credit: {
      opening: dollars(creditOpening),
      closing: dollars(creditClosing),
      available_now: dollars(creditNow),
      lines: creditLines.sort((a, b) => a.date.localeCompare(b.date)),
    },
  };
}
