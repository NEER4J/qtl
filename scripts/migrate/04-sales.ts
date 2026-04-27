// 04-sales.ts
// Import sales_jobs from the Sales sheet of 2026_RawData_Sales.xlsx.
// Expected spec §7: ~935 rows.
//
// Invoice numbering: unique per (location_id, invoice_no) among active rows.
// Collisions with rows already in the DB:
//   --allow-collisions=error  → abort the step
//   --allow-collisions=rename → suffix "-M<n>" and record it in report.collisions
//
// Customer linkage: look up by lower(billing_name) among active customers
// (step 02 seeded them). billing_name is also snapshotted on the sales row.

import { isAlreadyImported, recordImported } from "./utils/dedup";
import { hashRow } from "./utils/hash";
import { log } from "./utils/logger";
import {
  billingNameKey,
  derivePaymentStatus,
  normaliseBillingName,
  normaliseLocationCode,
  normalisePaymentMode,
  normaliseServiceCode,
  toIsoDate,
  toMoney,
  toOptInt,
  toOptStr,
  toStr,
} from "./utils/normalise";
import { openWorkbook, readSheet, requireHeaders } from "./utils/parse-xlsx";
import { bumpInserted, type SkippedRow } from "./utils/report";
import type { Step, StepContext } from "./utils/step";

const SHEET_NAME = "Sales";

async function run(ctx: StepContext): Promise<void> {
  const { sql, report, importerId, sourceFiles, allowCollisions } = ctx;

  const wb = openWorkbook(sourceFiles.sales);
  const sheet = readSheet(wb, SHEET_NAME);
  requireHeaders(sheet, [
    "location",
    "job_date",
    "invoice_no",
    "billing_name",
    "service_type",
    "sub_total",
    "hst",
    "total",
  ]);

  // Preload reference maps (small tables)
  const locByCode = await fetchLocations(sql);
  const svcByCode = await fetchServiceTypes(sql);
  const customerByKey = await fetchCustomers(sql);

  for (let i = 0; i < sheet.rows.length; i++) {
    const r = sheet.rows[i];
    const rowNum = i + 2;

    const skipped: SkippedRow = { sheet: sheet.name, row: rowNum, reason: "", data: r };

    const locCode = normaliseLocationCode(r.location ?? r.shop);
    if (!locCode) { skipped.reason = "unknown location"; report.skipped.push(skipped); continue; }
    const location = locByCode.get(locCode);
    if (!location) { skipped.reason = `location ${locCode} not seeded`; report.skipped.push(skipped); continue; }

    const svcCode = normaliseServiceCode(r.service_type ?? r.service);
    if (!svcCode) { skipped.reason = "unknown service type"; report.skipped.push(skipped); continue; }
    const service = svcByCode.get(svcCode);
    if (!service) { skipped.reason = `service ${svcCode} not seeded`; report.skipped.push(skipped); continue; }

    const jobDate = toIsoDate(r.job_date ?? r.date);
    if (!jobDate) { skipped.reason = "missing/invalid job_date"; report.skipped.push(skipped); continue; }

    let invoiceNo = toStr(r.invoice_no ?? r.invoice);
    if (!invoiceNo) { skipped.reason = "missing invoice_no"; report.skipped.push(skipped); continue; }

    const billingName = normaliseBillingName(r.billing_name);
    if (!billingName) { skipped.reason = "missing billing_name"; report.skipped.push(skipped); continue; }

    const subTotal = toMoney(r.sub_total);
    const hst      = toMoney(r.hst);
    const total    = toMoney(r.total);
    if (Math.abs(total - (subTotal + hst)) > 0.02) {
      skipped.reason = `total (${total}) does not match sub_total + hst (${subTotal} + ${hst})`;
      report.skipped.push(skipped);
      continue;
    }

    const paidAmount = toMoney(r.paid_amount ?? r.paid ?? 0);
    if (paidAmount > total + 0.01) {
      skipped.reason = `paid_amount ${paidAmount} exceeds total ${total}`;
      report.skipped.push(skipped);
      continue;
    }

    const paymentMode = normalisePaymentMode(r.payment_mode ?? r.pay_mode);
    const paymentStatus = derivePaymentStatus(total, paidAmount);
    const customerKey = billingNameKey(billingName);
    const customerId = customerByKey.get(customerKey) ?? null;

    const rowSig = hashRow([
      locCode, jobDate, invoiceNo, billingName, svcCode,
      subTotal, hst, total, paidAmount, paymentMode,
    ]);
    const sourceKey = `${sourceFiles.sales}::${SHEET_NAME}::sales_jobs`;

    if (await isAlreadyImported(sql, sourceKey, rowSig)) continue;

    // Collision detection: active row at same (location, invoice_no)?
    const collision = await sql<{ id: string }[]>`
      select id from public.sales_jobs
       where location_id = ${location.id}
         and invoice_no  = ${invoiceNo}
         and deactivated_at is null
       limit 1
    `;

    if (collision.length > 0) {
      if (allowCollisions === "error") {
        report.collisions.push({
          invoice_no: invoiceNo,
          location_code: locCode,
          existing_id: collision[0].id,
          action: "blocked",
        });
        throw new Error(
          `Invoice collision: ${locCode}/${invoiceNo} already exists (id ${collision[0].id}).\n` +
            `  Either delete/deactivate the existing row, fix the source data, or\n` +
            `  rerun with --allow-collisions=rename to auto-suffix.`,
        );
      }
      const renamed = await pickRenamedInvoice(sql, location.id, invoiceNo);
      report.collisions.push({
        invoice_no: invoiceNo,
        location_code: locCode,
        existing_id: collision[0].id,
        action: "renamed",
        new_invoice_no: renamed,
      });
      invoiceNo = renamed;
    }

    const inserted = await sql<{ id: string }[]>`
      insert into public.sales_jobs (
        location_id, job_date,
        bay_no, upper_tech, lower_tech,
        invoice_no, customer_id, billing_name,
        license_plate, contact_no, email, odometer,
        service_type_id, carrier_name, comments,
        sub_total, hst, total, paid_amount,
        payment_mode, payment_status,
        created_by, updated_by
      ) values (
        ${location.id}, ${jobDate},
        ${toOptInt(r.bay_no)}, ${toOptStr(r.upper_deck)}, ${toOptStr(r.lower_deck)},
        ${invoiceNo}, ${customerId}, ${billingName},
        ${toOptStr(r.license_plate)}, ${toOptStr(r.contact_no)}, ${toOptStr(r.email)}, ${toOptInt(r.odometer)},
        ${service.id}, ${toOptStr(r.carrier_name ?? r.carrier)}, ${toOptStr(r.comments ?? r.notes)},
        ${subTotal}, ${hst}, ${total}, ${paidAmount},
        ${paymentMode},
        ${paymentStatus}::payment_status,
        ${importerId}, ${importerId}
      )
      returning id
    `;

    bumpInserted(report, "sales_jobs");

    await recordImported(sql, {
      sourceFile: sourceKey,
      rowHash: rowSig,
      targetTable: "sales_jobs",
      targetId: inserted[0].id,
      importedBy: importerId,
    });
  }

  log.info(
    `sales: inserted=${report.inserted.sales_jobs ?? 0} skipped=${report.skipped.length} collisions=${report.collisions.length}`,
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

async function fetchServiceTypes(
  sql: StepContext["sql"],
): Promise<Map<string, { id: string }>> {
  const rows = await sql<{ id: string; code: string }[]>`
    select id, code from public.service_types where active = true
  `;
  return new Map(rows.map((r) => [r.code, { id: r.id }]));
}

async function fetchCustomers(
  sql: StepContext["sql"],
): Promise<Map<string, string>> {
  const rows = await sql<{ id: string; billing_name: string }[]>`
    select id, billing_name from public.customers where active = true
  `;
  return new Map(rows.map((r) => [r.billing_name.toLowerCase(), r.id]));
}

async function pickRenamedInvoice(
  sql: StepContext["sql"],
  locationId: string,
  base: string,
): Promise<string> {
  for (let n = 1; n < 100; n++) {
    const candidate = `${base}-M${n}`;
    const hit = await sql<{ id: string }[]>`
      select id from public.sales_jobs
       where location_id = ${locationId}
         and invoice_no  = ${candidate}
         and deactivated_at is null
       limit 1
    `;
    if (hit.length === 0) return candidate;
  }
  throw new Error(`Could not find a free rename for ${base} after 99 attempts`);
}

export const step: Step = { name: "sales", run };
