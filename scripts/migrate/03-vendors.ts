// 03-vendors.ts
// Extract unique vendors from the expenses workbook. Dedupe by lower(name).
// The Excel workbook has one sheet per expense category; we read every
// sheet that has a "Vendor" / "Vendor Name" column.

import { recordImported } from "./utils/dedup";
import { hashRow } from "./utils/hash";
import { log } from "./utils/logger";
import { toOptStr, toStr } from "./utils/normalise";
import { openWorkbook, readAllSheets } from "./utils/parse-xlsx";
import { bumpInserted } from "./utils/report";
import type { Step, StepContext } from "./utils/step";

async function run(ctx: StepContext): Promise<void> {
  const { sql, report, importerId, sourceFiles } = ctx;

  const wb = openWorkbook(sourceFiles.expenses);
  const sheets = readAllSheets(wb);

  // Map lower-name → { name, contact_no, email, account_no, account_type, category_name }
  type Agg = {
    name: string;
    contact_no: string | null;
    email: string | null;
    account_no: string | null;
    account_type: string | null;
    category_name: string | null;
  };
  const byKey = new Map<string, Agg>();

  for (const sheet of sheets) {
    if (!sheet.normalisedHeaders.includes("vendor")
        && !sheet.normalisedHeaders.includes("vendor_name")) {
      continue;
    }
    for (const r of sheet.rows) {
      const name = toStr(r.vendor ?? r.vendor_name);
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = byKey.get(key);
      const category = sheet.name; // Sheet name ≈ category name

      if (existing) {
        if (!existing.contact_no)   existing.contact_no   = toOptStr(r.contact_no);
        if (!existing.email)        existing.email        = toOptStr(r.email);
        if (!existing.account_no)   existing.account_no   = toOptStr(r.account_no ?? r.account_number);
        if (!existing.account_type) existing.account_type = toOptStr(r.account_type);
        if (!existing.category_name) existing.category_name = category;
      } else {
        byKey.set(key, {
          name,
          contact_no:   toOptStr(r.contact_no),
          email:        toOptStr(r.email),
          account_no:   toOptStr(r.account_no ?? r.account_number),
          account_type: toOptStr(r.account_type),
          category_name: category,
        });
      }
    }
  }

  log.info(`vendors: ${byKey.size} unique after dedup`);

  for (const agg of byKey.values()) {
    const existing = await sql<{ id: string }[]>`
      select id from public.vendors
       where lower(name) = ${agg.name.toLowerCase()}
         and active = true
       limit 1
    `;

    let targetId: string;
    if (existing.length > 0) {
      targetId = existing[0].id;
    } else {
      const categoryId = agg.category_name
        ? await fetchCategoryId(sql, agg.category_name)
        : null;

      const inserted = await sql<{ id: string }[]>`
        insert into public.vendors (
          name, contact_no, email, account_no, account_type,
          category_id, active, created_by, updated_by
        ) values (
          ${agg.name},
          ${agg.contact_no},
          ${agg.email},
          ${agg.account_no},
          ${agg.account_type},
          ${categoryId},
          true,
          ${importerId},
          ${importerId}
        )
        returning id
      `;
      targetId = inserted[0].id;
      bumpInserted(report, "vendors");
    }

    await recordImported(sql, {
      sourceFile: `${ctx.sourceFiles.expenses}::vendors`,
      rowHash: hashRow([agg.name.toLowerCase()]),
      targetTable: "vendors",
      targetId,
      importedBy: importerId,
    });
  }
}

async function fetchCategoryId(
  sql: StepContext["sql"],
  name: string,
): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    select id from public.expense_categories
     where lower(name) = ${name.toLowerCase()}
     limit 1
  `;
  return rows[0]?.id ?? null;
}

export const step: Step = { name: "vendors", run };
