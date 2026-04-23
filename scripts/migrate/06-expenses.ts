// 06-expenses.ts
// Import expenses from 2026_RawData_Expenses.xlsx. Per spec §7 the workbook
// has one sheet per expense category (Advertisement, Cleaning, Repair,
// Utility, Misc, Bank, Purchase, Others — 8 sheets, ~263 rows total).
//
// Sheet name → category name (case-insensitive match against
// public.expense_categories). Rows that don't resolve to a known category are
// skipped.

import { isAlreadyImported, recordImported } from "./utils/dedup";
import { hashRow } from "./utils/hash";
import { log } from "./utils/logger";
import {
  derivePaymentStatus,
  normaliseLocationCode,
  normalisePaymentMode,
  toIsoDate,
  toMoney,
  toOptStr,
  toStr,
} from "./utils/normalise";
import { openWorkbook, readAllSheets } from "./utils/parse-xlsx";
import { bumpInserted, type SkippedRow } from "./utils/report";
import type { Step, StepContext } from "./utils/step";

async function run(ctx: StepContext): Promise<void> {
  const { sql, report, importerId, sourceFiles } = ctx;

  const wb = openWorkbook(sourceFiles.expenses);
  const sheets = readAllSheets(wb);

  const locByCode    = await fetchLocations(sql);
  const catByName    = await fetchCategories(sql);
  const subcatByName = await fetchSubcategories(sql);
  const vendorByName = await fetchVendors(sql);

  for (const sheet of sheets) {
    const categoryName = sheet.name.trim();
    const category = catByName.get(categoryName.toLowerCase());
    if (!category) {
      log.warn(`skipping sheet "${sheet.name}" — no matching expense category`);
      continue;
    }

    // Not every sheet has the same columns, but these are the baseline.
    const mustHave = ["expense_date", "sub_total", "hst", "total"];
    const missing = mustHave.filter((k) => !sheet.normalisedHeaders.includes(k));
    if (missing.length > 0) {
      log.warn(`sheet "${sheet.name}" missing columns ${missing.join(", ")} — skipping`);
      continue;
    }

    for (let i = 0; i < sheet.rows.length; i++) {
      const r = sheet.rows[i];
      const rowNum = i + 2;
      const skipped: SkippedRow = { sheet: sheet.name, row: rowNum, reason: "", data: r };

      const locCode = normaliseLocationCode(r.location ?? r.shop);
      if (!locCode) { skipped.reason = "unknown location"; report.skipped.push(skipped); continue; }
      const location = locByCode.get(locCode);
      if (!location) { skipped.reason = `location ${locCode} not seeded`; report.skipped.push(skipped); continue; }

      const expenseDate = toIsoDate(r.expense_date ?? r.date);
      if (!expenseDate) { skipped.reason = "missing/invalid expense_date"; report.skipped.push(skipped); continue; }

      const subTotal = toMoney(r.sub_total);
      const hst      = toMoney(r.hst);
      const total    = toMoney(r.total);
      if (Math.abs(total - (subTotal + hst)) > 0.02) {
        skipped.reason = `total (${total}) != sub_total + hst (${subTotal} + ${hst})`;
        report.skipped.push(skipped);
        continue;
      }

      const paidAmount = toMoney(r.paid_amount ?? r.paid ?? 0);
      if (paidAmount > total + 0.01) {
        skipped.reason = `paid_amount ${paidAmount} exceeds total ${total}`;
        report.skipped.push(skipped);
        continue;
      }

      // Subcategory: match within this category only (enforced by trigger).
      const subcatName = toStr(r.subcategory ?? r.sub_category);
      const subcatId = subcatName
        ? subcatByName.get(`${category.id}:${subcatName.toLowerCase()}`) ?? null
        : null;

      const vendorName = toStr(r.vendor ?? r.vendor_name);
      const vendorId = vendorName
        ? vendorByName.get(vendorName.toLowerCase()) ?? null
        : null;

      const paymentMode = normalisePaymentMode(r.payment_mode ?? r.pay_mode);
      const paymentDate = toIsoDate(r.payment_date);
      const paymentStatus = derivePaymentStatus(total, paidAmount);
      const invoiceNo = toOptStr(r.invoice_no ?? r.invoice);

      const rowSig = hashRow([
        categoryName, locCode, expenseDate, invoiceNo ?? "",
        vendorName, subcatName, subTotal, hst, total, paidAmount, paymentMode,
      ]);
      const sourceKey = `${sourceFiles.expenses}::${sheet.name}::expenses`;

      if (await isAlreadyImported(sql, sourceKey, rowSig)) continue;

      const inserted = await sql<{ id: string }[]>`
        insert into public.expenses (
          location_id, expense_date,
          category_id, subcategory_id,
          vendor_id, vendor_name_snapshot, invoice_no,
          account_type, account_number, contact_no, email,
          sub_total, hst, total, paid_amount,
          payment_date, payment_mode, transaction_id, payment_status,
          notes,
          created_by, updated_by
        ) values (
          ${location.id}, ${expenseDate},
          ${category.id}, ${subcatId},
          ${vendorId}, ${vendorName || null}, ${invoiceNo},
          ${toOptStr(r.account_type)}, ${toOptStr(r.account_number ?? r.account_no)},
          ${toOptStr(r.contact_no)}, ${toOptStr(r.email)},
          ${subTotal}, ${hst}, ${total}, ${paidAmount},
          ${paymentDate}, ${paymentMode},
          ${toOptStr(r.transaction_id)},
          ${paymentStatus}::payment_status,
          ${toOptStr(r.notes ?? r.comments)},
          ${importerId}, ${importerId}
        )
        returning id
      `;

      bumpInserted(report, "expenses");

      await recordImported(sql, {
        sourceFile: sourceKey,
        rowHash: rowSig,
        targetTable: "expenses",
        targetId: inserted[0].id,
        importedBy: importerId,
      });
    }
  }

  log.info(
    `expenses: inserted=${report.inserted.expenses ?? 0} skipped=${report.skipped.length}`,
  );
}

async function fetchLocations(
  sql: StepContext["sql"],
): Promise<Map<string, { id: string }>> {
  const rows = await sql<{ id: string; code: string }[]>`
    select id, code from public.locations where active = true
  `;
  return new Map(rows.map((r) => [r.code, { id: r.id }]));
}

async function fetchCategories(
  sql: StepContext["sql"],
): Promise<Map<string, { id: string }>> {
  const rows = await sql<{ id: string; name: string }[]>`
    select id, name from public.expense_categories where active = true
  `;
  return new Map(rows.map((r) => [r.name.toLowerCase(), { id: r.id }]));
}

async function fetchSubcategories(
  sql: StepContext["sql"],
): Promise<Map<string, string>> {
  const rows = await sql<{ id: string; name: string; category_id: string }[]>`
    select id, name, category_id from public.expense_subcategories where active = true
  `;
  return new Map(rows.map((r) => [`${r.category_id}:${r.name.toLowerCase()}`, r.id]));
}

async function fetchVendors(
  sql: StepContext["sql"],
): Promise<Map<string, string>> {
  const rows = await sql<{ id: string; name: string }[]>`
    select id, name from public.vendors where active = true
  `;
  return new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));
}

export const step: Step = { name: "expenses", run };
