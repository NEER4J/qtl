// React-PDF monthly customer statement (client 2026-10-20) — imported
// dynamically by app/api/statements/[customerId]/pdf and
// lib/actions/statements.ts. Same letterhead as the invoice (InvoicePdf.tsx);
// then the account summary, the month's invoices and payments, earlier
// invoices still owing, and store credit.
import path from "path";
import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { CustomerMonthlyStatement } from "@/lib/actions/statements";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { paymentModeLabel } from "@/lib/utils/payment-modes";
import { monthLabel } from "@/lib/utils/statement";

const LOGO_PATH = path.join(process.cwd(), "public", "logo.png");

const TEXT = "#000000";
const MUTED = "#555555";
const LINE = "#000000";
const SHADE = "#eaeaea";

const styles = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: "Helvetica",
    paddingTop: 28,
    paddingBottom: 44,
    paddingHorizontal: 28,
    color: TEXT,
  },

  // ----- Header (as on the invoice)
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logo: { width: 104, height: 80, objectFit: "contain", marginRight: 12 },
  shopName: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  shopMeta: { fontSize: 8, color: MUTED, marginTop: 1 },
  shopMetaRow: { flexDirection: "row", marginTop: 1 },
  shopMetaCell: { fontSize: 8, color: MUTED, marginRight: 14 },
  headerRight: { alignItems: "flex-end" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  titleMonth: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
  metaRight: { fontSize: 8, marginTop: 2, color: MUTED },

  // ----- Bill-to + summary
  topRow: { flexDirection: "row", marginBottom: 10 },
  billTo: { flex: 1, borderWidth: 1, borderColor: LINE, padding: 8, marginRight: 8 },
  label: { fontSize: 7, color: MUTED, textTransform: "uppercase", marginBottom: 2 },
  billName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  summary: { flex: 1, borderWidth: 1, borderColor: LINE },
  summaryHeader: {
    backgroundColor: SHADE,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    padding: 4,
    textAlign: "center",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  summaryMuted: { color: MUTED },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    backgroundColor: SHADE,
    borderTopWidth: 1,
    borderTopColor: LINE,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },

  // ----- Tables
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 3, marginTop: 4 },
  table: { borderWidth: 1, borderColor: LINE, marginBottom: 10 },
  headRow: { flexDirection: "row", backgroundColor: SHADE, borderBottomWidth: 1, borderBottomColor: LINE },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999999" },
  rowLast: { flexDirection: "row" },
  footRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE, backgroundColor: "#f5f5f5" },
  th: { padding: 3, fontSize: 8, fontFamily: "Helvetica-Bold" },
  td: { padding: 3, fontSize: 8.5 },
  tdBold: { padding: 3, fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  empty: { padding: 6, fontSize: 8.5, color: MUTED },
  right: { textAlign: "right" },

  colDate: { width: 62 },
  colInv: { width: 62 },
  colPlate: { flex: 1 },
  colAmt: { width: 66, textAlign: "right" },
  colMethod: { width: 80 },
  colRef: { flex: 1 },
  colDesc: { flex: 1 },

  // ----- Foot of every page
  foot: {
    position: "absolute",
    bottom: 18,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: MUTED,
    borderTopWidth: 0.5,
    borderTopColor: MUTED,
    paddingTop: 3,
  },
  note: { fontSize: 8, color: MUTED, marginTop: 2 },
});

function money(n: number): string {
  return new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function dollars(n: number): string {
  return n < 0 ? `-$${money(-n)}` : `$${money(n)}`;
}
const plateLabel = (plate: string | null, unit: string | null) =>
  [plate, unit ? `Unit ${unit}` : null].filter(Boolean).join(" · ");

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={muted ? styles.summaryMuted : undefined}>{label}</Text>
      <Text style={muted ? styles.summaryMuted : undefined}>{value}</Text>
    </View>
  );
}

/**
 * A titled table. Short ones move to the next page whole rather than leave
 * their title stranded at the foot of a page; long ones split, and their
 * header row (`fixed`) repeats on each page.
 */
function Section({ title, rows, children }: { title: string; rows: number; children: React.ReactNode }) {
  return (
    <View wrap={rows > 20}>
      <Text style={styles.sectionTitle} minPresenceAhead={60}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function buildStatementDoc(s: CustomerMonthlyStatement) {
  const month = monthLabel(s.month);
  const pastMonth = s.end < s.generated_on;
  const sc = s.store_credit;
  const showCredit = sc.opening !== 0 || sc.closing !== 0 || sc.available_now !== 0 || sc.lines.length > 0;
  const invoiceTotals = s.invoices.reduce(
    (t, r) => ({
      total: t.total + r.total,
      credit: t.credit + r.credit_applied,
      paid: t.paid + r.paid,
      owing: t.owing + r.owing,
    }),
    { total: 0, credit: 0, paid: 0, owing: 0 },
  );
  const earlierOwing = s.earlier_owing.reduce((t, r) => t + r.owing, 0);

  return (
    <Document title={`Statement ${month} — ${s.customer.name}`} author="Quick Truck Lube">
      <Page size="LETTER" style={styles.page}>
        {/* ---------------- Letterhead ---------------- */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image takes no alt */}
            <Image src={LOGO_PATH} style={styles.logo} />
            <View>
              <Text style={styles.shopName}>{s.shop.name}</Text>
              {s.shop.address ? <Text style={styles.shopMeta}>{s.shop.address}</Text> : null}
              <View style={styles.shopMetaRow}>
                {s.shop.phone ? <Text style={styles.shopMetaCell}>{s.shop.phone}</Text> : null}
                {s.shop.gst ? <Text style={styles.shopMetaCell}>GST {s.shop.gst}</Text> : null}
              </View>
              {s.shop.email ? <Text style={styles.shopMeta}>{s.shop.email}</Text> : null}
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>Statement</Text>
            <Text style={styles.titleMonth}>{month}</Text>
            <Text style={styles.metaRight}>Statement date {formatDate(s.end)}</Text>
            {s.customer.code ? <Text style={styles.metaRight}>Account {s.customer.code}</Text> : null}
          </View>
        </View>

        {/* ---------------- Bill to | Account summary ---------------- */}
        <View style={styles.topRow} wrap={false}>
          <View style={styles.billTo}>
            <Text style={styles.label}>Statement for</Text>
            <Text style={styles.billName}>{s.customer.name}</Text>
            {s.customer.address_lines.map((l, i) => (
              <Text key={i}>{l}</Text>
            ))}
            {s.customer.phone ? <Text style={{ marginTop: 3 }}>{s.customer.phone}</Text> : null}
            {s.customer.email ? <Text>{s.customer.email}</Text> : null}
          </View>
          <View style={styles.summary}>
            <Text style={styles.summaryHeader}>Account summary</Text>
            {/* "–" rather than "−": the built-in Helvetica has no U+2212 and prints a blank. */}
            <SummaryRow label={`Balance owing on ${formatDate(s.start)}`} value={dollars(s.opening_balance)} />
            <SummaryRow
              label={`+ Invoices this month (${s.invoices.length})`}
              value={dollars(s.invoices_total)}
            />
            {s.credit_applied_total > 0 ? (
              <SummaryRow label="– Store credit applied" value={dollars(s.credit_applied_total)} />
            ) : null}
            <SummaryRow
              label={`– Payments received (${s.payments.length})`}
              value={dollars(s.payments_total)}
            />
            {s.overpayment_to_credit > 0 ? (
              <SummaryRow
                label="+ Paid beyond the invoices"
                value={dollars(s.overpayment_to_credit)}
              />
            ) : null}
            <View style={styles.summaryTotal}>
              <Text>Balance owing {formatDate(s.end)}</Text>
              <Text>{dollars(s.closing_balance)}</Text>
            </View>
            {pastMonth ? (
              <SummaryRow
                label={`Balance owing as of ${formatDate(s.generated_on)}`}
                value={dollars(s.balance_today)}
                muted
              />
            ) : null}
            {showCredit ? (
              <SummaryRow label="Store credit available" value={dollars(sc.available_now)} muted />
            ) : null}
          </View>
        </View>

        {/* ---------------- Invoices this month ---------------- */}
        <Section title={`Invoices — ${month}`} rows={s.invoices.length}>
          <View style={styles.table}>
            <View style={styles.headRow} fixed>
              <Text style={[styles.th, styles.colDate]}>Date</Text>
              <Text style={[styles.th, styles.colInv]}>Invoice #</Text>
              <Text style={[styles.th, styles.colPlate]}>Plate / unit</Text>
              <Text style={[styles.th, styles.colAmt]}>Amount</Text>
              <Text style={[styles.th, styles.colAmt]}>Credit</Text>
              <Text style={[styles.th, styles.colAmt]}>Paid</Text>
              <Text style={[styles.th, styles.colAmt]}>Owing</Text>
            </View>
            {s.invoices.length === 0 ? (
              <Text style={styles.empty}>No invoices this month.</Text>
            ) : (
              s.invoices.map((r, i) => (
                <View key={r.id} style={i === s.invoices.length - 1 ? styles.rowLast : styles.row} wrap={false}>
                  <Text style={[styles.td, styles.colDate]}>{formatDate(r.job_date)}</Text>
                  <Text style={[styles.td, styles.colInv]}>{r.invoice_no}</Text>
                  <Text style={[styles.td, styles.colPlate]}>{plateLabel(r.plate, r.unit_no)}</Text>
                  <Text style={[styles.td, styles.colAmt]}>{money(r.total)}</Text>
                  <Text style={[styles.td, styles.colAmt]}>{r.credit_applied ? money(r.credit_applied) : ""}</Text>
                  <Text style={[styles.td, styles.colAmt]}>{money(r.paid)}</Text>
                  <Text style={[r.owing > 0 ? styles.tdBold : styles.td, styles.colAmt]}>{money(r.owing)}</Text>
                </View>
              ))
            )}
            {s.invoices.length > 0 ? (
              <View style={styles.footRow} wrap={false}>
                <Text style={[styles.tdBold, styles.colDate]}>Total</Text>
                <Text style={[styles.td, styles.colInv]} />
                <Text style={[styles.td, styles.colPlate]} />
                <Text style={[styles.tdBold, styles.colAmt]}>{money(invoiceTotals.total)}</Text>
                <Text style={[styles.tdBold, styles.colAmt]}>{invoiceTotals.credit ? money(invoiceTotals.credit) : ""}</Text>
                <Text style={[styles.tdBold, styles.colAmt]}>{money(invoiceTotals.paid)}</Text>
                <Text style={[styles.tdBold, styles.colAmt]}>{money(invoiceTotals.owing)}</Text>
              </View>
            ) : null}
          </View>
        </Section>

        {/* ---------------- Payments received ---------------- */}
        <Section title={`Payments received — ${month}`} rows={s.payments.length}>
          <View style={styles.table}>
            <View style={styles.headRow} fixed>
              <Text style={[styles.th, styles.colDate]}>Date</Text>
              <Text style={[styles.th, styles.colMethod]}>Method</Text>
              <Text style={[styles.th, styles.colRef]}>Reference</Text>
              <Text style={[styles.th, styles.colInv]}>Invoice #</Text>
              <Text style={[styles.th, styles.colAmt]}>Amount</Text>
            </View>
            {s.payments.length === 0 ? (
              <Text style={styles.empty}>No payments received this month.</Text>
            ) : (
              s.payments.map((p, i) => (
                <View key={p.key} style={i === s.payments.length - 1 ? styles.rowLast : styles.row} wrap={false}>
                  <Text style={[styles.td, styles.colDate]}>{formatDate(p.paid_on)}</Text>
                  <Text style={[styles.td, styles.colMethod]}>{paymentModeLabel(p.mode)}</Text>
                  <Text style={[styles.td, styles.colRef]}>{p.reference ?? ""}</Text>
                  <Text style={[styles.td, styles.colInv]}>{p.invoice_no}</Text>
                  <Text style={[styles.td, styles.colAmt]}>{money(p.amount)}</Text>
                </View>
              ))
            )}
            {s.payments.length > 0 ? (
              <View style={styles.footRow} wrap={false}>
                <Text style={[styles.tdBold, styles.colDate]}>Total</Text>
                <Text style={[styles.td, styles.colMethod]} />
                <Text style={[styles.td, styles.colRef]} />
                <Text style={[styles.td, styles.colInv]} />
                <Text style={[styles.tdBold, styles.colAmt]}>{money(s.payments_total)}</Text>
              </View>
            ) : null}
          </View>
        </Section>

        {/* ---------------- Earlier invoices still owing ---------------- */}
        {s.earlier_owing.length > 0 ? (
          <Section
            title={`Earlier invoices still owing on ${formatDate(s.end)}`}
            rows={s.earlier_owing.length}
          >
            <View style={styles.table}>
              <View style={styles.headRow} fixed>
                <Text style={[styles.th, styles.colDate]}>Date</Text>
                <Text style={[styles.th, styles.colInv]}>Invoice #</Text>
                <Text style={[styles.th, styles.colPlate]}>Plate / unit</Text>
                <Text style={[styles.th, styles.colAmt]}>Amount</Text>
                <Text style={[styles.th, styles.colAmt]}>Owing</Text>
              </View>
              {s.earlier_owing.map((r, i) => (
                <View key={r.id} style={i === s.earlier_owing.length - 1 ? styles.rowLast : styles.row} wrap={false}>
                  <Text style={[styles.td, styles.colDate]}>{formatDate(r.job_date)}</Text>
                  <Text style={[styles.td, styles.colInv]}>{r.invoice_no}</Text>
                  <Text style={[styles.td, styles.colPlate]}>{plateLabel(r.plate, r.unit_no)}</Text>
                  <Text style={[styles.td, styles.colAmt]}>{money(r.total)}</Text>
                  <Text style={[styles.tdBold, styles.colAmt]}>{money(r.owing)}</Text>
                </View>
              ))}
              <View style={styles.footRow} wrap={false}>
                <Text style={[styles.tdBold, styles.colDate]}>Total</Text>
                <Text style={[styles.td, styles.colInv]} />
                <Text style={[styles.td, styles.colPlate]} />
                <Text style={[styles.td, styles.colAmt]} />
                <Text style={[styles.tdBold, styles.colAmt]}>{money(earlierOwing)}</Text>
              </View>
            </View>
          </Section>
        ) : null}

        {/* ---------------- Store credit ---------------- */}
        {showCredit ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Store credit</Text>
            <View style={styles.table}>
              <View style={styles.headRow}>
                <Text style={[styles.th, styles.colDate]}>Date</Text>
                <Text style={[styles.th, styles.colDesc]}>Description</Text>
                <Text style={[styles.th, styles.colInv]}>Invoice #</Text>
                <Text style={[styles.th, styles.colAmt]}>Amount</Text>
              </View>
              <View style={styles.row}>
                <Text style={[styles.td, styles.colDate]}>{formatDate(s.start)}</Text>
                <Text style={[styles.td, styles.colDesc]}>Credit at the start of the month</Text>
                <Text style={[styles.td, styles.colInv]} />
                <Text style={[styles.td, styles.colAmt]}>{money(sc.opening)}</Text>
              </View>
              {sc.lines.map((l) => (
                <View key={l.id} style={styles.row}>
                  <Text style={[styles.td, styles.colDate]}>{formatDate(l.date)}</Text>
                  <Text style={[styles.td, styles.colDesc]}>{l.description}</Text>
                  <Text style={[styles.td, styles.colInv]}>{l.invoice_no ?? ""}</Text>
                  <Text style={[styles.td, styles.colAmt]}>{money(l.amount)}</Text>
                </View>
              ))}
              <View style={styles.footRow}>
                <Text style={[styles.tdBold, styles.colDate]}>{formatDate(s.end)}</Text>
                <Text style={[styles.tdBold, styles.colDesc]}>Credit at the end of the month</Text>
                <Text style={[styles.td, styles.colInv]} />
                <Text style={[styles.tdBold, styles.colAmt]}>{money(sc.closing)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <Text style={styles.note}>
          Amounts in Canadian dollars, taxes included. Paid and owing amounts are as of{" "}
          {formatDate(s.end)}
          {pastMonth ? "; payments received after that show in the balance as of today" : ""}.
          {s.shop.phone ? ` Questions about this statement? Call ${s.shop.phone}.` : ""}
          {s.shops_only ? ` Covers invoices from ${s.shops_only.join(", ") || "this shop"} only.` : ""}
        </Text>

        <View style={styles.foot} fixed>
          <Text>
            {s.customer.name} · Statement {month} · Printed {formatDateTime(new Date())}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
