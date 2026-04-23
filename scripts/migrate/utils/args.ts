// CLI argument parsing for the migrate script.

export interface MigrateArgs {
  mode: "dry-run" | "commit";
  only: StepName | null;
  allowCollisions: "error" | "rename";
  dataDir: string;
  help: boolean;
}

const STEP_NAMES = [
  "seed-reference",
  "customers",
  "vendors",
  "sales",
  "sales-payments",
  "expenses",
  "expense-payments",
] as const;

export type StepName = (typeof STEP_NAMES)[number];

export const STEPS: readonly StepName[] = STEP_NAMES;

export function parseArgs(argv: string[]): MigrateArgs {
  const args: MigrateArgs = {
    mode: "dry-run",
    only: null,
    allowCollisions: "error",
    dataDir: "scripts/migrate/data",
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.mode = "dry-run";
    else if (a === "--commit") args.mode = "commit";
    else if (a === "--only") {
      const v = argv[++i];
      if (!v) throw new Error("--only requires a step name");
      assertStep(v);
      args.only = v;
    } else if (a.startsWith("--only=")) {
      const v = a.slice("--only=".length);
      assertStep(v);
      args.only = v;
    } else if (a === "--allow-collisions=rename") {
      args.allowCollisions = "rename";
    } else if (a === "--allow-collisions=error") {
      args.allowCollisions = "error";
    } else if (a.startsWith("--data-dir=")) {
      args.dataDir = a.slice("--data-dir=".length);
    } else if (a === "--help" || a === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  return args;
}

function assertStep(v: string): asserts v is StepName {
  if (!(STEP_NAMES as readonly string[]).includes(v)) {
    throw new Error(
      `Unknown step "${v}". Valid: ${STEP_NAMES.join(", ")}`,
    );
  }
}

export const HELP_TEXT = `qtl migrate — Excel → Postgres importer

Usage:
  npm run migrate -- [options]

Options:
  --dry-run                 Parse + validate + run inside a transaction that
                            rolls back at the end. No data persists. (default)
  --commit                  Run and commit.
  --only <step>             Run a single step. One of:
                              seed-reference, customers, vendors, sales,
                              sales-payments, expenses, expense-payments
  --allow-collisions=rename If an invoice number collides with an existing
                            active row, auto-rename to "<no>-M<n>".
                            Default: error and abort.
  --data-dir=<path>         Location of the Excel workbooks.
                            Default: scripts/migrate/data
  --help, -h                Show this help.

Required env (.env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  DATABASE_URL

Expected files in <data-dir>:
  2026_RawData_Sales.xlsx
  2026_RawData_Expenses.xlsx

See scripts/migrate/README.md for the full design.
`;
