// React-PDF invoice template — imported dynamically in lib/actions/invoices.ts.
// Layout mirrors the Quick Truck Lube paper invoice, filling the page
// (client 2026-10-20):
//   - large logo top-left + shop address / phone / GST on one line
//   - bill-to + vehicle info in a 3-column boxed grid
//   - one line-items table that stretches to the bottom block
//   - comments (job notes, the vehicle's printed comments, payments received)
//     and the signature line beside the Invoice Totals box
//   - the legal terms as fine print across the foot of the page
import path from "path";
import React from "react";
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { SalesJobDetail } from "@/lib/actions/sales";
import { OIL_TIER_GROUP, buildDisplayRows, foldOilTier } from "@/lib/utils/sales-display";
import { isMhswCategoryName } from "@/lib/utils/mhsw";

const LOGO_PATH = path.join(process.cwd(), "public", "logo.png");

const TEXT = "#000000";
const MUTED = "#555555";
const LINE = "#000000";

const styles = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: "Helvetica",
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
    color: TEXT,
  },

  // ----- Header
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logo: { width: 104, height: 80, objectFit: "contain", marginRight: 12 },
  shopName: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  shopLocation: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 1 },
  shopMeta: { fontSize: 8, color: MUTED, marginTop: 1 },
  shopMetaRow: { flexDirection: "row", marginTop: 1 },
  shopMetaCell: { fontSize: 8, color: MUTED, marginRight: 14 },
  // The GST/HST number prints bold and dark (client 2026-11-20).
  gstNumber: { fontFamily: "Helvetica-Bold", color: TEXT },
  headerRight: { alignItems: "flex-end" },
  invoiceTitle: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  invoiceMetaRight: { fontSize: 8, marginTop: 1, color: MUTED },
  invoiceDate: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 2 },

  // ----- Customer / vehicle box
  custBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: LINE,
    marginTop: 6,
    marginBottom: 8,
  },
  custCol: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: LINE,
    padding: 6,
  },
  custColLast: { flex: 1, padding: 6 },
  cellLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  cellValue: { fontSize: 9 },
  cellValueBold: { fontSize: 9, fontFamily: "Helvetica-Bold" },

  // 2-column wrapper for label/value pairs
  fieldGrid: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", paddingVertical: 2, paddingRight: 4 },
  fieldFull: { width: "100%", paddingVertical: 2 },

  // Phones — one row each. Three side-by-side boxes in a third of the page
  // were ~55pt wide, narrower than a formatted number, so it ran outside.
  phoneBox: { borderWidth: 1, borderColor: LINE, marginTop: 4 },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  phoneRowLast: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 2 },
  phoneLabel: { width: 46, fontSize: 7, color: MUTED, textTransform: "uppercase" },
  phoneValue: { flex: 1, fontSize: 9 },

  // ----- Section table headers
  sectionTable: { borderWidth: 1, borderColor: LINE, marginBottom: 6 },
  // The line-items table grows to fill the page down to the bottom block.
  itemsTable: { borderWidth: 1, borderColor: LINE, marginBottom: 6, flexGrow: 1 },
  sectionHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#eaeaea",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  sectionHeaderCell: {
    padding: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    borderRightWidth: 1,
    borderRightColor: LINE,
  },
  sectionHeaderCellLast: {
    padding: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  sectionRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  sectionRowLast: { flexDirection: "row" },
  sectionCell: {
    padding: 4,
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: LINE,
  },
  sectionCellLast: { padding: 4, fontSize: 9 },

  labourDesc: { flex: 1 },
  labourAmt: { width: 90, textAlign: "right" },

  partsQty: { width: 50, textAlign: "right" },
  partsDesc: { flex: 1 },
  partsUnit: { width: 70, textAlign: "right" },
  partsMhsw: { width: 50, textAlign: "right" },
  partsAmt: { width: 70, textAlign: "right" },

  packageBadge: {
    fontSize: 7,
    color: MUTED,
    fontStyle: "italic",
    marginTop: 1,
  },
  includedItem: { fontSize: 8, color: MUTED, paddingLeft: 8 },
  includedAmt: { fontSize: 8, color: MUTED },
  mergedAmt: { textDecoration: "line-through" },

  // ----- Comments
  commentsBox: {
    borderWidth: 1,
    borderColor: LINE,
    padding: 6,
    marginBottom: 8,
    minHeight: 28,
  },
  commentsLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },

  // ----- Footer (comments + signature beside the totals, fine print below)
  footerRow: { flexDirection: "row", marginTop: 2 },
  disclaimerCol: { flex: 1.6, paddingRight: 8 },
  finePrint: {
    marginTop: 8,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: MUTED,
    fontSize: 6.5,
    color: MUTED,
    lineHeight: 1.3,
  },
  signatureLine: {
    marginTop: 22,
    fontSize: 8,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 2,
    width: "75%",
  },
  printedAt: { fontSize: 7, color: MUTED, marginTop: 4 },

  totalsCol: { flex: 1, borderWidth: 1, borderColor: LINE },
  totalsHeader: {
    backgroundColor: "#eaeaea",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    padding: 4,
    textAlign: "center",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 9,
  },
  totalsRowEmphasis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#eaeaea",
  },
});

const DISCLAIMER =
  "I acknowledge that I have inspected the vehicle and I am satisfied. Quick Truck Lube shall not be responsible for oil leaks caused by the work done by it or its employees whether the same resulted from the negligence of Quick Truck Lube. Torquing of all oil plugs are witnessed by customer/driver to ensure Quick Truck Lube has performed its duties and therefore not responsible for any loose or lost plugs after leaving Quick Truck Lube premises. Quick Truck Lube shall not be responsible for loss or damage to the vehicle or articles left in the vehicle whether caused by fire theft or any other cause whatsoever, including negligence on the part of Quick Truck Lube and its employees. I hereby agree that Quick Truck Lube shall retain a registerable lien for any unpaid portion of the total charges. I authorize Quick Truck Lube or it's agents to seize the vehicle without notice to me. I also acknowledge that I will pay all charges and costs incurred by Quick Truck Lube including legal costs in the collection of any outstanding debts. I further agree to pay interest at 2 per cent (24% per annum) on any unpaid balance of the total charges.";

function money(n: number | null | undefined): string {
  if (n == null) return "0.00";
  return new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n));
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  return new Date(s)
    .toLocaleDateString("en-CA", { month: "short", day: "2-digit", year: "numeric" })
    .toUpperCase();
}

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d
    .toLocaleDateString("en-CA", { month: "short", day: "2-digit", year: "2-digit" })
    .toUpperCase()} at ${pad(d.getHours())} ${pad(d.getMinutes())} ${pad(d.getSeconds())}`;
}

function labelForMode(mode: string): string {
  switch (mode) {
    case "cash": return "Cash";
    case "cheque": return "Cheque";
    case "debit": return "Debit";
    case "visa": return "Visa";
    case "mastercard": return "MasterCard";
    case "etransfer": return "E-Transfer";
    case "credit_card": return "Credit Card";
    case "oc": return "OC";
    default: return mode;
  }
}

export interface InvoiceDocOptions {
  /** Used to label the HST row, e.g. 0.13 → "HST (13%)". */
  hstRate?: number;
}

export function buildInvoiceDoc(job: SalesJobDetail, opts: InvoiceDocOptions = {}) {
  const hstLabel =
    opts.hstRate != null
      ? `HST (${Math.round(opts.hstRate * 1000) / 10}%)`
      : "HST";
  // Collapse package instances into a single "Description of Work" line, then
  // split the remaining standalone items into Labour (custom items, no part_id)
  // and Parts (catalog items).
  const display = buildDisplayRows(
    job.items,
    (it) => Number(it.line_total ?? 0),
    (it) => it.is_taxable === true,
    (it) => it.package_label ?? "Package",
  );
  // What prints: the same rows, with an oil and its tier premium folded into
  // one line (foldOilTier). The totals below keep using `display`, so the
  // premium still counts under Miscellaneous.
  const shown = buildDisplayRows(
    foldOilTier(job.items),
    (it) => Number(it.line_total ?? 0),
    (it) => it.is_taxable === true,
    (it) => it.package_label ?? "Package",
  );
  type PrintPackage = {
    key: string;
    label: string;
    total: number;
    items: (typeof job.items)[number][];
    /** The oil folded into this line, printed as one more "Included" row. */
    oilNote?: string;
  };
  const allPackageRows: PrintPackage[] = shown.flatMap((r) =>
    r.type === "package"
      ? [{ key: r.key, label: r.label, total: r.total, items: r.items }]
      : [],
  );
  // Package + oil + tier print as ONE line, the oil grade shown under it and
  // no tier line anywhere (client 2026-11-24: customers argue about the tier
  // line). The oil-and-tier row goes into the engine's package — the first
  // package with no oil of its own (a Trans & Diff package carries oils).
  // With no such package the oil prints alone, still without the tier text.
  // Paper only: the job screen keeps the tier visible for staff.
  const oilTierRow = allPackageRows.find((r) => r.key.startsWith(OIL_TIER_GROUP)) ?? null;
  const oilTierLine = oilTierRow?.items.find((m) => m.auto_fee == null) ?? null;
  const oilTierText = oilTierLine
    ? `${oilTierLine.description} × ${Number(oilTierLine.quantity)} ${
        oilTierLine.oil_container === "gallon" ? "gal" : "L"
      }`
    : "";
  const hostPackage = oilTierRow
    ? allPackageRows.find(
        (r) => r !== oilTierRow && !r.key.startsWith(OIL_TIER_GROUP) && r.items.every((m) => !m.oil_type_id),
      ) ?? null
    : null;
  const packageRows: PrintPackage[] = allPackageRows.flatMap((r) => {
    if (r === oilTierRow && hostPackage) return [];
    if (r === hostPackage && oilTierRow) {
      return [{ ...r, total: r.total + oilTierRow.total, oilNote: oilTierText }];
    }
    if (r === oilTierRow) return [{ ...r, label: oilTierText, items: [] }];
    return [r];
  });
  const shownSingles = shown.flatMap((r) => (r.type === "single" ? [r.item] : []));
  const singles = display.flatMap((r) => (r.type === "single" ? [r.item] : []));
  const labour = singles.filter((it) => !it.part_id);
  // MHSW is charged through catalogue parts in the "MHSW" category, but it is
  // not a part (client 2026-11-20, invoice 23023: "MHSW not parts", "Total
  // Parts = only parts"). Those lines, plus any Sell MHSW baked into a part's
  // unit price (mhsw_unit), total on their own row.
  // Two kinds of MHSW line: the "MHSW" category parts staff added by hand
  // (QTL1010 / QTL1011), and the automatic "MHSW — parts" / "MHSW — bulk oil"
  // lines the job form adds since 0169 (auto_fee mhsw_parts / mhsw_oil).
  const isAutoMhsw = (it: (typeof singles)[number]) =>
    it.auto_fee === "mhsw_parts" || it.auto_fee === "mhsw_oil";
  const isMhswLine = (it: (typeof singles)[number]) =>
    isAutoMhsw(it) || (!!it.part_id && isMhswCategoryName(it.part_category_name));
  const parts = singles.filter((it) => !!it.part_id && !isMhswLine(it));
  const mhswLines = singles.filter(isMhswLine);
  // Jobs from before 0169 carry their MHSW inside the part prices (mhsw_unit
  // is the portion). From 0169 a job's parts are priced without it and the
  // MHSW lines charge it, so nothing is "inside". Old jobs have both waivers
  // set (0169 step 4), and so does a job saved before the columns exist.
  const mhswInsidePrices = job.mhsw_parts_waived !== false && job.mhsw_oil_waived !== false;
  // Packages, oil and labour lines used to total under "Total Labour"; the
  // client struck that row out (invoice 23023, 2026-11-20), so they show on
  // their own lines only. Subtotal/HST/Total come from the stored job fields,
  // so the totals box never has to add up to the subtotal by itself.
  // Charges the sales form adds itself — the volume tier premium and the
  // grease-only fee (0149) — total under Miscellaneous.
  const isAutoCharge = (it: (typeof singles)[number]) => it.auto_fee != null;
  // Sell MHSW inside a part's price: per-unit snapshot x qty, negative on a
  // return line. Customer-supplied parts charge nothing.
  const embeddedMhsw = (it: (typeof singles)[number]) => {
    if (!mhswInsidePrices || it.is_customer_supplied === true) return 0;
    const m = Number(it.mhsw_unit) || 0;
    const sign = Number(it.line_total ?? 0) < 0 ? -1 : 1;
    return Math.round(m * Number(it.quantity) * 100) / 100 * sign;
  };
  const totalEmbeddedMhsw = parts.reduce((s, it) => s + embeddedMhsw(it), 0);
  const totalParts =
    parts.reduce((s, it) => s + Number(it.line_total ?? 0), 0) - totalEmbeddedMhsw;
  const totalMhsw =
    mhswLines.reduce((s, it) => s + Number(it.line_total ?? 0), 0) + totalEmbeddedMhsw;
  // A tier premium folded into the oil line is inside that line's amount, so
  // it doesn't total again under Miscellaneous.
  const totalMisc = labour
    .filter(isAutoCharge)
    .filter((it) => !isAutoMhsw(it))
    .filter((it) => !(oilTierRow && it.auto_fee === "oil_tier_premium"))
    .reduce((s, it) => s + Number(it.line_total ?? 0), 0);

  return (
    <Document title={`Invoice ${job.invoice_no ?? ""}`} author="Quick Truck Lube">
      <Page size="LETTER" style={styles.page}>
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image src={LOGO_PATH} style={styles.logo} />
            <View>
              {/* Logo carries the brand; show ONE name line (the branch/location),
                  not a duplicate. (client 2026-06-30 — "name and logo both".) */}
              <Text style={styles.shopName}>
                {job.location_name || job.location_invoice_name || "Quick Truck Lube"}
              </Text>
              <Text style={styles.shopMeta}>
                {job.location_address || "1010 Industrial Road, Ayr, Ontario, N0B 1E0"}
              </Text>
              <View style={styles.shopMetaRow}>
                <Text style={styles.shopMetaCell}>{job.location_phone || "(519) 622-0660"}</Text>
                {/* The business number alone — "RT 001" is the account suffix,
                    and the fax is gone (client 2026-10-20). */}
                <Text style={[styles.shopMetaCell, styles.gstNumber]}>
                  GST {(job.location_hst_number || "84754-0960").replace(/\s*RT\s*\d+\s*$/i, "")}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>Invoice {job.invoice_no ?? ""}</Text>
            <Text style={styles.invoiceDate}>{fmtDate(job.job_date)}</Text>
            <Text style={styles.invoiceMetaRight}>Business #</Text>
            <Text style={styles.invoiceMetaRight}>Page 1</Text>
          </View>
        </View>

        {/* ---------------- Customer / vehicle box ---------------- */}
        <View style={styles.custBox}>
          {/* Col 1 — bill to + phones */}
          <View style={styles.custCol}>
            <Text style={styles.cellValueBold}>{job.billing_name}</Text>
            {job.billing_address ? (
              <Text style={[styles.cellValue, { marginTop: 1 }]}>
                {job.billing_address}
              </Text>
            ) : null}
            <View style={styles.phoneBox}>
              <View style={styles.phoneRow}>
                <Text style={styles.phoneLabel}>Business</Text>
                <Text style={styles.phoneValue}>{job.business_phone ?? ""}</Text>
              </View>
              <View style={styles.phoneRow}>
                <Text style={styles.phoneLabel}>Other</Text>
                <Text style={styles.phoneValue}>{job.alt_phone ?? ""}</Text>
              </View>
              <View style={styles.phoneRowLast}>
                <Text style={styles.phoneLabel}>Cell</Text>
                <Text style={styles.phoneValue}>{job.contact_no ?? ""}</Text>
              </View>
            </View>
          </View>

          {/* Col 2 — order / unit / year / make / engine */}
          <View style={styles.custCol}>
            <View style={styles.fieldFull}>
              <Text style={styles.cellLabel}>Customer Order Number</Text>
              <Text style={styles.cellValue}>{job.customer_order_no ?? ""}</Text>
            </View>
            <View style={styles.fieldGrid}>
              <View style={styles.field}>
                <Text style={styles.cellLabel}>Unit No.</Text>
                <Text style={styles.cellValue}>{job.unit_no ?? ""}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.cellLabel}>Engine Size</Text>
                <Text style={styles.cellValue}>{job.engine_size ?? ""}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.cellLabel}>Year</Text>
                <Text style={styles.cellValue}>
                  {job.vehicle_year != null ? String(job.vehicle_year) : ""}
                </Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.cellLabel}>Make</Text>
                <Text style={styles.cellValue}>{job.vehicle_make ?? ""}</Text>
              </View>
            </View>
          </View>

          {/* Col 3 — W/O date, license, model, VIN, odometer */}
          <View style={styles.custColLast}>
            <View style={styles.fieldGrid}>
              <View style={styles.field}>
                <Text style={styles.cellLabel}>W/O Date</Text>
                <Text style={styles.cellValue}>{fmtDate(job.job_date)}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.cellLabel}>License</Text>
                <Text style={styles.cellValue}>{job.license_plate ?? ""}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.cellLabel}>Model</Text>
                <Text style={styles.cellValue}>{job.vehicle_model ?? ""}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.cellLabel}>Odometer</Text>
                <Text style={styles.cellValue}>
                  {job.odometer != null ? job.odometer.toLocaleString() : ""}
                </Text>
              </View>
              <View style={styles.fieldFull}>
                <Text style={styles.cellLabel}>VIN</Text>
                <Text style={styles.cellValue}>{job.vin ?? ""}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ---------------- Line items (work + parts in one table) ---------------- */}
        <View style={styles.itemsTable}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeaderCell, styles.partsQty]}>Qty</Text>
            <Text style={[styles.sectionHeaderCell, styles.partsDesc]}>Description</Text>
            <Text style={[styles.sectionHeaderCell, styles.partsUnit]}>Unit Price</Text>
            <Text style={[styles.sectionHeaderCell, styles.partsMhsw]}>MHSW</Text>
            <Text style={[styles.sectionHeaderCellLast, styles.partsAmt]}>Amount</Text>
          </View>
          {(() => {
            // One table for everything: packages (collapsed — items shown as
            // "Included"), then labour, then catalog parts. The MHSW column is
            // each part's MHSW per unit: on jobs from 0169 on it is charged on
            // the "MHSW — parts" line; on older jobs it sits inside the amount.
            type LineRow = {
              id: string;
              qty: string;
              description: string;
              unit: string;
              unitMuted?: boolean;
              unitStrike?: boolean;
              mhsw: string;
              amount: string;
              indent?: boolean;
              note?: string;
            };
            const rows: LineRow[] = [];

            for (const r of packageRows) {
              const saved = r.items.reduce(
                (s, m) =>
                  s +
                  (m.merged_unit_price != null
                    ? Number(m.merged_unit_price) * Number(m.quantity)
                    : 0),
                0,
              );
              const oilWithTier = r.key.startsWith(OIL_TIER_GROUP);
              const oil = oilWithTier ? oilTierLine : null;
              rows.push({
                id: r.key,
                qty: oil
                  ? `${Number(oil.quantity)} ${oil.oil_container === "gallon" ? "gal" : "ltr"}`
                  : "1",
                description:
                  saved > 0 ? `${r.label}  (merged — saved ${money(saved)})` : r.label,
                unit: "",
                mhsw: "",
                amount: money(r.total),
              });
              for (const m of r.items) {
                const merged = m.merged_unit_price != null;
                rows.push({
                  id: m.id,
                  qty: "",
                  description: merged
                    ? `${m.description} — merged (already on the job)`
                    : m.description,
                  unit: merged ? money(Number(m.merged_unit_price)) : "Included",
                  unitMuted: true,
                  unitStrike: merged,
                  mhsw: "",
                  amount: "",
                  indent: true,
                });
              }
              if (r.oilNote) {
                rows.push({
                  id: `${r.key}:oil`,
                  qty: "",
                  description: r.oilNote,
                  unit: "Included",
                  unitMuted: true,
                  mhsw: "",
                  amount: "",
                  indent: true,
                });
              }
            }

            for (const it of shownSingles.filter((x) => !x.part_id && !isAutoMhsw(x))) {
              rows.push({
                id: it.id,
                qty: String(Number(it.quantity)),
                description: it.description,
                unit: money(Number(it.unit_price)),
                mhsw: "—",
                amount: money(Number(it.line_total)),
              });
            }

            // Parts first, then the MHSW lines — MHSW is not a part.
            const partSingles = shownSingles.filter((x) => !!x.part_id);
            const isMhsw = (x: (typeof partSingles)[number]) =>
              isMhswCategoryName(x.part_category_name);
            for (const it of [
              ...partSingles.filter((x) => !isMhsw(x)),
              ...partSingles.filter(isMhsw),
              ...shownSingles.filter(isAutoMhsw),
            ]) {
              const cs = it.is_customer_supplied === true;
              const wouldHaveCharged =
                Math.round(Number(it.quantity) * Number(it.unit_price) * 100) / 100;
              rows.push({
                id: it.id,
                qty: it.unit_of_measure
                  ? `${Number(it.quantity)} ${it.unit_of_measure}`
                  : String(Number(it.quantity)),
                description: it.description,
                unit: money(Number(it.unit_price)),
                mhsw: Number(it.mhsw_unit) > 0 ? money(Number(it.mhsw_unit)) : "—",
                amount: money(Number(it.line_total)),
                note: cs ? `(customer supplied — saved ${money(wouldHaveCharged)})` : undefined,
              });
            }

            if (rows.length === 0) {
              return (
                <View style={styles.sectionRowLast}>
                  <Text style={[styles.sectionCell, styles.partsQty]}> </Text>
                  <Text style={[styles.sectionCell, styles.partsDesc]}> </Text>
                  <Text style={[styles.sectionCell, styles.partsUnit]}> </Text>
                  <Text style={[styles.sectionCell, styles.partsMhsw]}> </Text>
                  <Text style={[styles.sectionCellLast, styles.partsAmt]}> </Text>
                </View>
              );
            }

            return rows.map((w, i) => {
              const last = i === rows.length - 1;
              return (
                <View key={w.id} style={last ? styles.sectionRowLast : styles.sectionRow}>
                  <Text style={[styles.sectionCell, styles.partsQty]}>{w.qty}</Text>
                  <View style={[styles.sectionCell, styles.partsDesc]}>
                    <Text style={w.indent ? styles.includedItem : undefined}>
                      {w.indent ? `•  ${w.description}` : w.description}
                    </Text>
                    {w.note ? <Text style={styles.packageBadge}>{w.note}</Text> : null}
                  </View>
                  <Text
                    style={[
                      styles.sectionCell,
                      styles.partsUnit,
                      w.unitMuted ? styles.includedAmt : {},
                      w.unitStrike ? styles.mergedAmt : {},
                    ]}
                  >
                    {w.unit}
                  </Text>
                  <Text style={[styles.sectionCell, styles.partsMhsw]}>{w.mhsw}</Text>
                  <Text style={[styles.sectionCellLast, styles.partsAmt]}>{w.amount}</Text>
                </View>
              );
            });
          })()}
        </View>

        {/* ---------------- Footer: comments + signature | totals ---------------- */}
        <View style={styles.footerRow} wrap={false}>
          <View style={styles.disclaimerCol}>
            <View style={styles.commentsBox}>
              <Text style={styles.commentsLabel}>Comments</Text>
              {job.comments ? <Text>{job.comments}</Text> : null}
              {/* The vehicle's "Printed comments (Invoice)" print on every invoice
                  for that truck (client 2026-10-20). */}
              {job.vehicle_printed_comments ? (
                <Text style={{ marginTop: job.comments ? 3 : 0 }}>{job.vehicle_printed_comments}</Text>
              ) : null}
              {/* Payments — iterate every sales_payments row so multi-mode
                  ("$100 cash + $50 Visa") shows up correctly. Fall back to the
                  legacy single line when the ledger is empty but paid_amount > 0,
                  which happens on imported / pre-multipay jobs. */}
              {job.payments && job.payments.length > 0 ? (
                <View style={{ marginTop: job.comments ? 3 : 0 }}>
                  {job.payments.map((p, idx) => (
                    <Text key={p.id ?? idx}>
                      Payment of ${money(p.amount)} by {labelForMode(p.mode)}
                      {job.invoice_no ? `, inv#${job.invoice_no}` : ""} — Received with thanks
                    </Text>
                  ))}
                </View>
              ) : job.paid_amount > 0 ? (
                <Text style={{ marginTop: job.comments ? 3 : 0 }}>
                  Payment of ${money(job.paid_amount)}
                  {job.payment_mode ? ` by ${labelForMode(job.payment_mode)}` : ""}
                  {job.invoice_no ? `, inv#${job.invoice_no}` : ""} — Received with thanks
                </Text>
              ) : null}
            </View>
            <Text style={styles.signatureLine}>CUSTOMER&apos;S SIGNATURE</Text>
          </View>

          <View style={styles.totalsCol}>
            <Text style={styles.totalsHeader}>Invoice Totals</Text>
            <View style={styles.totalsRow}>
              <Text>Total Parts</Text>
              <Text>{money(totalParts)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text>Total MHSW</Text>
              <Text>{money(totalMhsw)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text>Total Sublet</Text>
              <Text>{money(0)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text>Total Miscellaneous</Text>
              <Text>{money(totalMisc)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Subtotal</Text>
              <Text>{money(job.sub_total)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{hstLabel}</Text>
              <Text>{money(job.hst)}</Text>
            </View>
            {(job.credit_applied ?? 0) > 0 && (
              <View style={styles.totalsRow}>
                <Text>Store credit applied</Text>
                <Text>{money(-(job.credit_applied ?? 0))}</Text>
              </View>
            )}
            <View style={styles.totalsRowEmphasis}>
              <Text>Total Amount</Text>
              <Text>${money(job.total)}</Text>
            </View>
            {(job.credit_applied ?? 0) > 0 && (
              <View style={styles.totalsRow}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Balance due</Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>
                  ${money(job.total - (job.credit_applied ?? 0) - (job.paid_amount ?? 0))}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ---------------- Fine print ---------------- */}
        <Text style={styles.finePrint} wrap={false}>{DISCLAIMER}</Text>
        {/* At the very bottom, under the terms (client 2026-11-20). */}
        <Text style={styles.printedAt}>Printed on {nowStamp()}</Text>
      </Page>
    </Document>
  );
}
