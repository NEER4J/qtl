// React-PDF invoice template — imported dynamically in lib/actions/invoices.ts.
// Layout mirrors the Quick Truck Lube paper invoice:
//   - logo top-left + shop address / phone / GST / FAX on the same line
//   - bill-to + vehicle info in a 3-column boxed grid
//   - "Description of Work" (labour, custom items) and "Parts" tables stacked
//   - comments/payment-received line
//   - bottom-left legal disclaimer + signature line
//   - bottom-right Invoice Totals box
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
  logo: { width: 48, height: 48, objectFit: "contain", marginRight: 10 },
  shopName: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  shopMeta: { fontSize: 8, color: MUTED, marginTop: 1 },
  shopMetaRow: { flexDirection: "row", marginTop: 1 },
  shopMetaCell: { fontSize: 8, color: MUTED, marginRight: 14 },
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

  // Phone strip
  phoneRow: { flexDirection: "row", marginTop: 4 },
  phoneCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    padding: 4,
    minHeight: 28,
    marginRight: 4,
  },
  phoneCellLast: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    padding: 4,
    minHeight: 28,
  },

  // ----- Section table headers
  sectionTable: { borderWidth: 1, borderColor: LINE, marginBottom: 6 },
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
  partsAmt: { width: 70, textAlign: "right" },

  packageBadge: {
    fontSize: 7,
    color: MUTED,
    fontStyle: "italic",
    marginTop: 1,
  },

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

  // ----- Footer (disclaimer + totals)
  footerRow: { flexDirection: "row", marginTop: 8 },
  disclaimerCol: { flex: 1.6, paddingRight: 8 },
  disclaimerText: { fontSize: 7, color: TEXT, lineHeight: 1.3 },
  signatureLine: {
    marginTop: 14,
    fontSize: 8,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 2,
    width: "75%",
  },
  printedAt: { fontSize: 7, color: MUTED, marginTop: 8 },

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
  // Split lines into Labour (custom items, no part_id) and Parts (catalog items).
  const labour = job.items.filter((it) => !it.part_id);
  const parts = job.items.filter((it) => !!it.part_id);
  const totalLabour = labour.reduce((s, it) => s + Number(it.line_total ?? 0), 0);
  const totalParts = parts.reduce((s, it) => s + Number(it.line_total ?? 0), 0);

  return (
    <Document title={`Invoice ${job.invoice_no ?? ""}`} author="Quick Truck Lube">
      <Page size="LETTER" style={styles.page}>
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image src={LOGO_PATH} style={styles.logo} />
            <View>
              <Text style={styles.shopName}>Quick Truck Lube</Text>
              <Text style={styles.shopMeta}>1010 Industrial Road, Ayr, Ontario, N0B 1E0</Text>
              <View style={styles.shopMetaRow}>
                <Text style={styles.shopMetaCell}>(519) 622-0660</Text>
                <Text style={styles.shopMetaCell}>GST 84754-0960 RT 001</Text>
                <Text style={styles.shopMetaCell}>FAX 519-622-2493</Text>
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
            <View style={styles.phoneRow}>
              <View style={styles.phoneCell}>
                <Text style={styles.cellLabel}>Business</Text>
                <Text style={styles.cellValue}>{job.business_phone ?? ""}</Text>
              </View>
              <View style={styles.phoneCell}>
                <Text style={styles.cellLabel}>Other</Text>
                <Text style={styles.cellValue}>{job.alt_phone ?? ""}</Text>
              </View>
              <View style={styles.phoneCellLast}>
                <Text style={styles.cellLabel}>Cell</Text>
                <Text style={styles.cellValue}>{job.contact_no ?? ""}</Text>
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

        {/* ---------------- Description of Work (labour) ---------------- */}
        <View style={styles.sectionTable}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeaderCell, styles.labourDesc]}>
              Description of Work
            </Text>
            <Text style={[styles.sectionHeaderCellLast, styles.labourAmt]}>Amount</Text>
          </View>
          {labour.length === 0 ? (
            <View style={styles.sectionRowLast}>
              <Text style={[styles.sectionCell, styles.labourDesc]}> </Text>
              <Text style={[styles.sectionCellLast, styles.labourAmt]}> </Text>
            </View>
          ) : (
            labour.map((it, i) => {
              const last = i === labour.length - 1;
              return (
                <View key={it.id} style={last ? styles.sectionRowLast : styles.sectionRow}>
                  <View style={[styles.sectionCell, styles.labourDesc]}>
                    <Text>{it.description}</Text>
                    {it.package_label && (
                      <Text style={styles.packageBadge}>(from {it.package_label})</Text>
                    )}
                  </View>
                  <Text style={[styles.sectionCellLast, styles.labourAmt]}>
                    {money(Number(it.line_total))}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ---------------- Parts ---------------- */}
        <View style={styles.sectionTable}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeaderCell, styles.partsQty]}>Qty</Text>
            <Text style={[styles.sectionHeaderCell, styles.partsDesc]}>
              Parts Description
            </Text>
            <Text style={[styles.sectionHeaderCell, styles.partsUnit]}>Unit Price</Text>
            <Text style={[styles.sectionHeaderCellLast, styles.partsAmt]}>Amount</Text>
          </View>
          {parts.length === 0 ? (
            <View style={styles.sectionRowLast}>
              <Text style={[styles.sectionCell, styles.partsQty]}> </Text>
              <Text style={[styles.sectionCell, styles.partsDesc]}> </Text>
              <Text style={[styles.sectionCell, styles.partsUnit]}> </Text>
              <Text style={[styles.sectionCellLast, styles.partsAmt]}> </Text>
            </View>
          ) : (
            parts.map((it, i) => {
              const last = i === parts.length - 1;
              const qtyLabel = it.unit_of_measure
                ? `${Number(it.quantity)} ${it.unit_of_measure}`
                : String(Number(it.quantity));
              return (
                <View key={it.id} style={last ? styles.sectionRowLast : styles.sectionRow}>
                  <Text style={[styles.sectionCell, styles.partsQty]}>{qtyLabel}</Text>
                  <View style={[styles.sectionCell, styles.partsDesc]}>
                    <Text>{it.description}</Text>
                    {it.package_label && (
                      <Text style={styles.packageBadge}>(from {it.package_label})</Text>
                    )}
                  </View>
                  <Text style={[styles.sectionCell, styles.partsUnit]}>
                    {money(Number(it.unit_price))}
                  </Text>
                  <Text style={[styles.sectionCellLast, styles.partsAmt]}>
                    {money(Number(it.line_total))}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ---------------- Comments ---------------- */}
        <View style={styles.commentsBox}>
          <Text style={styles.commentsLabel}>Comments</Text>
          {job.comments ? <Text>{job.comments}</Text> : null}
          {job.paid_amount > 0 && (
            <Text style={{ marginTop: job.comments ? 3 : 0 }}>
              Payment of ${money(job.paid_amount)}
              {job.payment_mode ? ` by ${labelForMode(job.payment_mode)}` : ""}
              {job.invoice_no ? `, inv#${job.invoice_no}` : ""} — Received with thanks
            </Text>
          )}
        </View>

        {/* ---------------- Footer (disclaimer + totals) ---------------- */}
        <View style={styles.footerRow}>
          <View style={styles.disclaimerCol}>
            <Text style={styles.disclaimerText}>{DISCLAIMER}</Text>
            <Text style={styles.signatureLine}>CUSTOMER&apos;S SIGNATURE</Text>
            <Text style={styles.printedAt}>Printed on {nowStamp()}</Text>
          </View>

          <View style={styles.totalsCol}>
            <Text style={styles.totalsHeader}>Invoice Totals</Text>
            <View style={styles.totalsRow}>
              <Text>Total Labour</Text>
              <Text>{money(totalLabour)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text>Total Parts</Text>
              <Text>{money(totalParts)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text>Total Sublet</Text>
              <Text>{money(0)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text>Total Miscellaneous</Text>
              <Text>{money(0)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Subtotal</Text>
              <Text>{money(job.sub_total)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{hstLabel}</Text>
              <Text>{money(job.hst)}</Text>
            </View>
            <View style={styles.totalsRowEmphasis}>
              <Text>Total Amount</Text>
              <Text>${money(job.total)}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
