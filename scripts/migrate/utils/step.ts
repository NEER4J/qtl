// Shared types for migration steps.

import type { Sql } from "./db";
import type { StepReport } from "./report";
import type { StepName } from "./args";

export interface StepContext {
  sql: Sql;
  report: StepReport;
  dataDir: string;
  importerId: string;
  mode: "dry-run" | "commit";
  allowCollisions: "error" | "rename";
  sourceFiles: {
    sales: string;          // relative path of the sales workbook
    expenses: string;       // relative path of the expenses workbook
  };
}

export interface Step {
  name: StepName;
  run(ctx: StepContext): Promise<void>;
}
