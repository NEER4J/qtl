// 07-expense-payments.ts
// Backfill expense_payments for imported expenses that have a non-zero
// paid_amount. Same approach as 05-sales-payments: one synthetic payment row
// per paid/partial expense, amount = existing paid_amount, mode = row's
// payment_mode (default "cash"), dated = payment_date or expense_date.

import { recordImported } from "./utils/dedup";
import { hashRow } from "./utils/hash";
import { log } from "./utils/logger";
import { bumpInserted } from "./utils/report";
import type { Step, StepContext } from "./utils/step";

async function run(ctx: StepContext): Promise<void> {
  const { sql, report, importerId, sourceFiles } = ctx;

  const rows = await sql<
    {
      id: string;
      expense_date: string;
      payment_date: string | null;
      paid_amount: number;
      payment_mode: string | null;
    }[]
  >`
    select e.id, e.expense_date, e.payment_date, e.paid_amount, e.payment_mode
      from public.expenses e
      join public.migration_source ms
        on ms.target_table = 'expenses'
       and ms.target_id    = e.id::text
     where e.paid_amount > 0
       and not exists (
         select 1 from public.expense_payments ep
          where ep.expense_id = e.id
       )
  `;

  log.info(`expense_payments: ${rows.length} candidate expenses`);

  for (const r of rows) {
    const mode = r.payment_mode ?? "cash";
    const paidOn = r.payment_date ?? r.expense_date;
    const sig = hashRow([r.id, r.paid_amount, mode]);
    const sourceKey = `${sourceFiles.expenses}::expense_payments`;

    const inserted = await sql<{ id: string }[]>`
      insert into public.expense_payments (
        expense_id, paid_on, amount, mode, notes, created_by
      ) values (
        ${r.id},
        ${paidOn},
        ${r.paid_amount},
        ${mode}::payment_mode,
        ${"Backfilled from Excel during migration"},
        ${importerId}
      )
      returning id
    `;

    bumpInserted(report, "expense_payments");

    await recordImported(sql, {
      sourceFile: sourceKey,
      rowHash: sig,
      targetTable: "expense_payments",
      targetId: inserted[0].id,
      importedBy: importerId,
    });
  }
}

export const step: Step = { name: "expense-payments", run };
