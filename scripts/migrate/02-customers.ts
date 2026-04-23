// 02-customers.ts
// Pull unique customers out of the sales workbook, dedupe by
// lower(trim(billing_name)), merge license plates across rows.

import { recordImported } from "./utils/dedup";
import { hashRow } from "./utils/hash";
import { log } from "./utils/logger";
import {
  billingNameKey,
  normaliseBillingName,
  normaliseLocationCode,
  toOptStr,
  toPlates,
} from "./utils/normalise";
import { openWorkbook, readSheet, requireHeaders } from "./utils/parse-xlsx";
import { bumpInserted, bumpUpdated } from "./utils/report";
import type { Step, StepContext } from "./utils/step";

const SHEET_NAME = "Sales";

async function run(ctx: StepContext): Promise<void> {
  const { sql, report, importerId, sourceFiles } = ctx;

  const wb = openWorkbook(sourceFiles.sales);
  const sheet = readSheet(wb, SHEET_NAME);
  requireHeaders(sheet, ["billing_name"]);

  // Build an in-memory aggregate keyed by billingNameKey so we issue one
  // upsert per unique customer.
  type Agg = {
    billing_name: string;
    contact_no: string | null;
    email: string | null;
    plates: Set<string>;
    home_location_code: string | null;
    first_row: number;
    row_hash: string;
  };
  const byKey = new Map<string, Agg>();

  for (let i = 0; i < sheet.rows.length; i++) {
    const r = sheet.rows[i];
    const name = normaliseBillingName(r.billing_name);
    if (!name) continue;
    const key = billingNameKey(name);

    const plates = toPlates(r.license_plate);
    const location = normaliseLocationCode(r.location) ?? normaliseLocationCode(r.shop);

    const existing = byKey.get(key);
    if (existing) {
      for (const p of plates) existing.plates.add(p);
      if (!existing.contact_no) existing.contact_no = toOptStr(r.contact_no);
      if (!existing.email)      existing.email      = toOptStr(r.email);
      if (!existing.home_location_code && location) existing.home_location_code = location;
    } else {
      byKey.set(key, {
        billing_name: name,
        contact_no: toOptStr(r.contact_no),
        email:      toOptStr(r.email),
        plates: new Set(plates),
        home_location_code: location ?? null,
        first_row: i + 2, // +1 for header, +1 for 1-based
        row_hash: hashRow([key]),
      });
    }
  }

  log.info(`customers: ${byKey.size} unique after dedup`);

  for (const agg of byKey.values()) {
    const sourceFile = `${sourceFiles.sales}::${SHEET_NAME}::customer`;

    // Upsert semantics: match on lower(billing_name) among active rows; if
    // found, merge plates additively; else insert new.
    const existing = await sql<{ id: string; license_plates: string[] }[]>`
      select id, license_plates
        from public.customers
       where lower(billing_name) = ${agg.billing_name.toLowerCase()}
         and active = true
       limit 1
    `;

    let targetId: string;
    if (existing.length > 0) {
      const row = existing[0];
      const merged = Array.from(new Set([...(row.license_plates ?? []), ...agg.plates]));
      if (merged.length !== (row.license_plates ?? []).length) {
        await sql`
          update public.customers
             set license_plates = ${merged as unknown as string[]},
                 updated_by = ${importerId}
           where id = ${row.id}
        `;
        bumpUpdated(report, "customers");
      }
      targetId = row.id;
    } else {
      const homeLocationId = agg.home_location_code
        ? await fetchLocationId(sql, agg.home_location_code)
        : null;

      const inserted = await sql<{ id: string }[]>`
        insert into public.customers (
          billing_name, contact_no, email, license_plates,
          home_location_id, active, created_by, updated_by
        ) values (
          ${agg.billing_name},
          ${agg.contact_no},
          ${agg.email},
          ${Array.from(agg.plates) as unknown as string[]},
          ${homeLocationId},
          true,
          ${importerId},
          ${importerId}
        )
        returning id
      `;
      targetId = inserted[0].id;
      bumpInserted(report, "customers");
    }

    await recordImported(sql, {
      sourceFile,
      rowHash: agg.row_hash,
      targetTable: "customers",
      targetId,
      importedBy: importerId,
    });
  }
}

async function fetchLocationId(
  sql: StepContext["sql"],
  code: string,
): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    select id from public.locations where code = ${code} limit 1
  `;
  return rows[0]?.id ?? null;
}

export const step: Step = { name: "customers", run };
