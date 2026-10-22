/**
 * What a job was paid with, one entry per tender (client 2026-10-20 — daily
 * report and monthly statement show payment methods).
 *
 * sales_payments is the ledger. Legacy / imported jobs settled paid_amount on
 * the job itself with no ledger rows and a single payment_mode, so that amount
 * counts as one payment on the job date — the same fallback the sales list and
 * the invoice PDF use. Should the rows ever add up to less than paid_amount,
 * the gap is treated the same way, so the totals always match the job.
 */
export interface PaymentRowLike {
  id: string;
  paid_on: string;
  amount: number | string;
  mode: string;
  transaction_id?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface Tender {
  /** null for a legacy payment settled on the job (no ledger row). */
  id: string | null;
  paid_on: string;
  amount: number;
  mode: string | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string | null;
  legacy: boolean;
}

export function jobTenders(
  job: { job_date: string; paid_amount: number | string; payment_mode: string | null },
  rows: readonly PaymentRowLike[] | null | undefined,
): Tender[] {
  const tenders: Tender[] = (rows ?? []).map((p) => ({
    id: p.id,
    paid_on: p.paid_on,
    amount: Number(p.amount),
    mode: p.mode,
    transaction_id: p.transaction_id ?? null,
    notes: p.notes ?? null,
    created_at: p.created_at ?? null,
    legacy: false,
  }));
  const ledgerCents = tenders.reduce((s, t) => s + Math.round(t.amount * 100), 0);
  const gapCents = Math.round(Number(job.paid_amount) * 100) - ledgerCents;
  if (gapCents > 0) {
    tenders.push({
      id: null,
      paid_on: job.job_date,
      amount: gapCents / 100,
      mode: job.payment_mode,
      transaction_id: null,
      notes: null,
      created_at: null,
      legacy: true,
    });
  }
  return tenders;
}

/** Tenders summed per method, largest first ("Visa $100 + Cash $50"). */
export function tendersByMode(tenders: readonly Tender[]): { mode: string | null; amount: number }[] {
  const map = new Map<string | null, number>();
  for (const t of tenders) map.set(t.mode, (map.get(t.mode) ?? 0) + Math.round(t.amount * 100));
  return [...map.entries()]
    .map(([mode, cents]) => ({ mode, amount: cents / 100 }))
    .sort((a, b) => b.amount - a.amount);
}
