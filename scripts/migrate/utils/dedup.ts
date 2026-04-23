// Helpers around the migration_source tracking table.

import type { Sql } from "./db";

export async function isAlreadyImported(
  sql: Sql,
  sourceFile: string,
  rowHash: string,
): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    select 1 as exists
      from public.migration_source
     where source_file = ${sourceFile}
       and row_hash    = ${rowHash}
     limit 1
  `;
  return rows.length > 0;
}

export async function recordImported(
  sql: Sql,
  params: {
    sourceFile: string;
    rowHash: string;
    targetTable: string;
    targetId: string;
    importedBy: string;
  },
): Promise<void> {
  await sql`
    insert into public.migration_source
      (source_file, row_hash, target_table, target_id, imported_by)
    values
      (${params.sourceFile}, ${params.rowHash}, ${params.targetTable}, ${params.targetId}, ${params.importedBy})
    on conflict (source_file, row_hash) do nothing
  `;
}
