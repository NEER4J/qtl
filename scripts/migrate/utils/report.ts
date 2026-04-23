// Per-run JSON report writer. Each step pushes counts + skipped rows; the
// orchestrator dumps the aggregate to scripts/migrate/reports/<ts>.json.

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { StepName } from "./args";

export interface SkippedRow {
  sheet: string;
  row: number;            // 1-based, matches Excel row
  reason: string;
  data?: Record<string, unknown>;
}

export interface CollisionRow {
  invoice_no: string;
  location_code: string;
  existing_id: string;
  action: "renamed" | "blocked";
  new_invoice_no?: string;
}

export interface StepReport {
  step: StepName;
  started_at: string;
  finished_at: string;
  inserted: Record<string, number>;   // table → count
  updated:  Record<string, number>;
  skipped:  SkippedRow[];
  collisions: CollisionRow[];
}

export interface RunReport {
  started_at: string;
  finished_at: string;
  mode: "dry-run" | "commit";
  only: string | null;
  data_dir: string;
  steps: StepReport[];
}

export function createStepReport(step: StepName): StepReport {
  return {
    step,
    started_at: new Date().toISOString(),
    finished_at: "",
    inserted: {},
    updated:  {},
    skipped:  [],
    collisions: [],
  };
}

export function bumpInserted(r: StepReport, table: string, by = 1): void {
  r.inserted[table] = (r.inserted[table] ?? 0) + by;
}

export function bumpUpdated(r: StepReport, table: string, by = 1): void {
  r.updated[table] = (r.updated[table] ?? 0) + by;
}

export async function writeRunReport(
  report: RunReport,
): Promise<string> {
  const dir = resolve(process.cwd(), "scripts/migrate/reports");
  await mkdir(dir, { recursive: true });
  const stamp = report.started_at.replace(/[:.]/g, "-");
  const path = resolve(dir, `${stamp}.json`);
  await writeFile(path, JSON.stringify(report, null, 2), "utf8");
  return path;
}

export function summariseRun(report: RunReport): string {
  const lines: string[] = [];
  for (const s of report.steps) {
    const totals = Object.entries(s.inserted)
      .map(([t, n]) => `${t}:${n}`)
      .join(" ");
    const upd = Object.entries(s.updated)
      .map(([t, n]) => `${t}:${n}`)
      .join(" ");
    lines.push(
      `  ${s.step.padEnd(18)} inserted=${totals || "-"}` +
        (upd ? ` updated=${upd}` : "") +
        (s.skipped.length ? ` skipped=${s.skipped.length}` : "") +
        (s.collisions.length ? ` collisions=${s.collisions.length}` : ""),
    );
  }
  return lines.join("\n");
}
