/**
 * Writes that name columns from a migration that may not be applied yet.
 *
 * Migrations here are run by hand, after the code that uses them is live. A
 * write naming a column the database doesn't have yet fails with PostgREST's
 * PGRST204 ("Could not find the 'x' column …") or Postgres's 42703; rather
 * than fail the whole save, the column is dropped and the write retried —
 * the same pattern as lib/actions/sales.ts.
 */

export type DbError = { code?: string; message?: string } | null;

/** PostgREST's "no such column" naming one of `columns`. */
export function isMissingColumn(error: DbError, columns: readonly string[]): boolean {
  if (!error || (error.code !== "PGRST204" && error.code !== "42703")) return false;
  return columns.some((c) => (error.message ?? "").includes(c));
}

export function omitKeys<T extends Record<string, unknown>>(row: T, keys: readonly string[]): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of keys) delete out[k];
  return out as T;
}

export interface PendingColumns {
  /** Dropped together when any one of them is reported missing. */
  columns: readonly string[];
  /** Set when quietly dropping a value would lose something the user typed:
   *  the save stops with this message instead. Unset = drop silently. */
  ifSet?: string;
}

const hasValue = (v: unknown) => v !== undefined && v !== null && v !== "" && v !== 0;

/** Run a write; while it fails on a pending column, drop that group and retry. */
export async function writeDroppingPending(
  write: (row: Record<string, unknown>) => PromiseLike<{ data: unknown; error: DbError }>,
  row: Record<string, unknown>,
  pending: readonly PendingColumns[],
): Promise<{ data: unknown; error: DbError }> {
  let result = await write(row);
  const left = [...pending];
  while (result.error) {
    const i = left.findIndex((p) => isMissingColumn(result.error, p.columns));
    if (i < 0) break;
    const [group] = left.splice(i, 1);
    if (group.ifSet && group.columns.some((c) => hasValue(row[c]))) throw new Error(group.ifSet);
    row = omitKeys(row, group.columns);
    result = await write(row);
  }
  return result;
}
