// scripts/migrate/index.ts
// Orchestrator for the Excel → Postgres importer.
// Run with:
//   npm run migrate -- --dry-run
//   npm run migrate -- --commit
//   npm run migrate -- --only sales
//
// See utils/args.ts for full flag list.

import { HELP_TEXT, STEPS, parseArgs, type StepName } from "./utils/args";
import { closeSql } from "./utils/db";
import { withTx } from "./utils/db";
import { log } from "./utils/logger";
import {
  createStepReport,
  summariseRun,
  writeRunReport,
  type RunReport,
} from "./utils/report";
import type { Step } from "./utils/step";
import { ensureImportUser } from "./utils/supabase-admin";

import { step as seedReferenceStep } from "./01-seed-reference";
import { step as customersStep } from "./02-customers";
import { step as vendorsStep } from "./03-vendors";
import { step as salesStep } from "./04-sales";
import { step as salesPaymentsStep } from "./05-sales-payments";
import { step as expensesStep } from "./06-expenses";
import { step as expensePaymentsStep } from "./07-expense-payments";

const REGISTRY: Record<StepName, Step> = {
  "seed-reference":   seedReferenceStep,
  customers:          customersStep,
  vendors:            vendorsStep,
  sales:              salesStep,
  "sales-payments":   salesPaymentsStep,
  expenses:           expensesStep,
  "expense-payments": expensePaymentsStep,
};

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  log.info(
    `mode=${args.mode}  only=${args.only ?? "all"}  data-dir=${args.dataDir}`,
  );

  log.step("Ensuring system import user exists");
  const importerId = await ensureImportUser();
  log.ok(`import user = ${importerId}`);

  const plan: StepName[] = args.only ? [args.only] : [...STEPS];

  const runReport: RunReport = {
    started_at: new Date().toISOString(),
    finished_at: "",
    mode: args.mode,
    only: args.only,
    data_dir: args.dataDir,
    steps: [],
  };

  for (const stepName of plan) {
    const step = REGISTRY[stepName];
    const stepReport = createStepReport(stepName);
    runReport.steps.push(stepReport);
    log.step(`${stepName} — starting`);

    try {
      await withTx(
        { commit: args.mode === "commit", actorId: importerId },
        async (sql) => {
          await step.run({
            sql,
            report: stepReport,
            dataDir: args.dataDir,
            importerId,
            mode: args.mode,
            allowCollisions: args.allowCollisions,
            sourceFiles: {
              sales: `${args.dataDir}/2026_RawData_Sales.xlsx`,
              expenses: `${args.dataDir}/2026_RawData_Expenses.xlsx`,
            },
          });
        },
      );
      stepReport.finished_at = new Date().toISOString();
      log.ok(`${stepName} — done`);
    } catch (err) {
      stepReport.finished_at = new Date().toISOString();
      runReport.finished_at = new Date().toISOString();
      const reportPath = await writeRunReport(runReport);
      log.error(`${stepName} — FAILED`);
      log.error(String(err instanceof Error ? err.stack ?? err.message : err));
      log.info(`Report written to ${reportPath}`);
      await closeSql();
      process.exit(1);
    }
  }

  runReport.finished_at = new Date().toISOString();
  const reportPath = await writeRunReport(runReport);
  log.info("Summary:");
  console.log(summariseRun(runReport));
  log.info(`Report written to ${reportPath}`);

  if (args.mode === "dry-run") {
    log.warn("dry-run: all database changes were rolled back.");
  } else {
    log.ok("committed.");
  }

  await closeSql();
}

main().catch(async (err) => {
  log.error(String(err instanceof Error ? err.stack ?? err.message : err));
  await closeSql();
  process.exit(1);
});
