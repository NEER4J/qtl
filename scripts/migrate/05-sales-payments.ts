// 05-sales-payments.ts
// Backfill sales_payments rows for imported sales_jobs that have a non-zero
// paid_amount. Excel doesn't track individual payment events, so we synthesise
// one payment row per paid/partial job, dated = job_date, mode = the job's
// payment_mode (default "cash" if unset).
//
// The rollup trigger on sales_payments recomputes paid_amount + status, so we
// have to be careful: after inserting, sales_jobs.paid_amount must equal the
// pre-existing value. We achieve that by making the synthesised payment equal
// the existing paid_amount exactly.

import { recordImported } from "./utils/dedup";
import { hashRow } from "./utils/hash";
import { log } from "./utils/logger";
import { bumpInserted } from "./utils/report";
import type { Step, StepContext } from "./utils/step";

async function run(ctx: StepContext): Promise<void> {
  const { sql, report, importerId, sourceFiles } = ctx;

  // Only consider sales_jobs that the importer itself created and that have
  // no existing payment row (to keep this step idempotent).
  const jobs = await sql<
    {
      id: string;
      job_date: string;
      paid_amount: number;
      payment_mode: string | null;
      invoice_no: string;
    }[]
  >`
    select sj.id, sj.job_date, sj.paid_amount, sj.payment_mode, sj.invoice_no
      from public.sales_jobs sj
      join public.migration_source ms
        on ms.target_table = 'sales_jobs'
       and ms.target_id    = sj.id::text
     where sj.paid_amount > 0
       and not exists (
         select 1 from public.sales_payments sp
          where sp.sales_job_id = sj.id
       )
  `;

  log.info(`sales_payments: ${jobs.length} candidate jobs`);

  for (const job of jobs) {
    const mode = job.payment_mode ?? "cash";
    const sig = hashRow([job.id, job.paid_amount, mode]);
    const sourceKey = `${sourceFiles.sales}::sales_payments`;

    const inserted = await sql<{ id: string }[]>`
      insert into public.sales_payments (
        sales_job_id, paid_on, amount, mode, notes, created_by
      ) values (
        ${job.id},
        ${job.job_date},
        ${job.paid_amount},
        ${mode}::payment_mode,
        ${"Backfilled from Excel during migration"},
        ${importerId}
      )
      returning id
    `;

    bumpInserted(report, "sales_payments");

    await recordImported(sql, {
      sourceFile: sourceKey,
      rowHash: sig,
      targetTable: "sales_payments",
      targetId: inserted[0].id,
      importedBy: importerId,
    });
  }
}

export const step: Step = { name: "sales-payments", run };
