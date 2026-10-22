// React-PDF pay stub — rendered by app/api/payroll/[weekId]/stubs/route.ts.
// Same look as the invoice (components/pdf/InvoicePdf.tsx): large logo
// top-left with the shop's name, address, phone and business number; boxed
// employee / period / payment grid; ruled tables with grey headers. One page
// per employee, each showing this period and the year to date.
// (client 2026-10-20 — "pay stub: add pay date and the other missing details,
// clean layout like the invoice")
import path from "path";
import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { PayStub, StubLine } from "@/lib/utils/pay-stub";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils/format";

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
    paddingBottom: 28,
    paddingHorizontal: 28,
    color: TEXT,
  },

  // ----- Header (as the invoice)
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  logo: { width: 104, height: 80, objectFit: "contain", marginRight: 12 },
  shopName: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  shopLocation: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 1 },
  shopMeta: { fontSize: 8, color: MUTED, marginTop: 1 },
  shopMetaRow: { flexDirection: "row", marginTop: 1 },
  shopMetaCell: { fontSize: 8, color: MUTED, marginRight: 14 },
  headerRight: { alignItems: "flex-end" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  payDateLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", marginTop: 4 },
  payDate: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  metaRight: { fontSize: 8, marginTop: 1, color: MUTED },
  statusBadge: {
    marginTop: 3,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 5,
    paddingVertical: 1,
    textTransform: "uppercase",
  },

  // ----- Employee / period / payment box
  infoBox: { flexDirection: "row", borderWidth: 1, borderColor: LINE, marginTop: 6, marginBottom: 8 },
  infoCol: { flex: 1, borderRightWidth: 1, borderRightColor: LINE, padding: 6 },
  infoColLast: { flex: 1, padding: 6 },
  boxHeading: {
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 3,
    fontFamily: "Helvetica-Bold",
  },
  employeeName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  field: { flexDirection: "row", paddingVertical: 1 },
  fieldLabel: { width: 62, fontSize: 7, color: MUTED, textTransform: "uppercase", paddingTop: 1 },
  fieldValue: { flex: 1, fontSize: 9 },

  // ----- Tables
  table: { borderWidth: 1, borderColor: LINE, marginBottom: 8 },
  headRow: { flexDirection: "row", backgroundColor: SHADE, borderBottomWidth: 1, borderBottomColor: LINE },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  rowLast: { flexDirection: "row" },
  totalRow: { flexDirection: "row", backgroundColor: SHADE },
  cell: { padding: 4, borderRightWidth: 1, borderRightColor: LINE },
  cellLast: { padding: 4 },
  head: { fontFamily: "Helvetica-Bold" },
  bold: { fontFamily: "Helvetica-Bold" },
  desc: { flex: 1 },
  hours: { width: 50, textAlign: "right" },
  rate: { width: 62, textAlign: "right" },
  amt: { width: 82, textAlign: "right" },

  small: { fontSize: 8 },
  smallMuted: { fontSize: 8, color: MUTED },

  // ----- Bottom: deductions | net pay box
  twoCol: { flexDirection: "row" },
  leftCol: { flex: 1.45, paddingRight: 8 },
  rightCol: { flex: 1 },

  netBox: { borderWidth: 1, borderColor: LINE, marginBottom: 8 },
  netHeader: {
    backgroundColor: SHADE,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    padding: 4,
    textAlign: "center",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  netEmphasis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    backgroundColor: SHADE,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  netRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  commentsBox: { borderWidth: 1, borderColor: LINE, padding: 6, marginBottom: 8, minHeight: 28 },
  commentsLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },

  footer: {
    marginTop: "auto",
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: MUTED,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: MUTED,
  },
});

/** Money for a table cell: "—" for a nil line keeps the columns readable. */
const amount = (v: number) => (v === 0 ? "—" : formatMoney(v));

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || "—"}</Text>
    </View>
  );
}

/** A Current / Year-to-date table; `withHours` adds the Hours and Rate columns. */
function AmountTable({
  heading,
  lines,
  total,
  withHours = false,
  compact = false,
}: {
  heading: string;
  lines: StubLine[];
  total?: { label: string; current: number; ytd: number } | null;
  withHours?: boolean;
  compact?: boolean;
}) {
  const text = compact ? styles.small : undefined;
  return (
    <View style={styles.table} wrap={false}>
      <View style={styles.headRow}>
        <Text style={[styles.cell, styles.head, styles.desc, text ?? {}]}>{heading}</Text>
        {withHours && <Text style={[styles.cell, styles.head, styles.hours]}>Hours</Text>}
        {withHours && <Text style={[styles.cell, styles.head, styles.rate]}>Rate</Text>}
        <Text style={[styles.cell, styles.head, styles.amt, text ?? {}]}>Current</Text>
        <Text style={[styles.cellLast, styles.head, styles.amt, text ?? {}]}>Year to date</Text>
      </View>
      {lines.map((l, i) => {
        const last = i === lines.length - 1 && !total;
        return (
          <View key={l.label} style={last ? styles.rowLast : styles.row}>
            <Text style={[styles.cell, styles.desc, text ?? {}]}>{l.label}</Text>
            {withHours && <Text style={[styles.cell, styles.hours]}>{l.hours ?? ""}</Text>}
            {withHours && (
              <Text style={[styles.cell, styles.rate]}>{l.rate != null ? formatMoney(l.rate) : ""}</Text>
            )}
            <Text style={[styles.cell, styles.amt, text ?? {}]}>{amount(l.current)}</Text>
            <Text style={[styles.cellLast, styles.amt, text ?? {}]}>{amount(l.ytd)}</Text>
          </View>
        );
      })}
      {total && (
        <View style={styles.totalRow}>
          <Text style={[styles.cell, styles.bold, styles.desc, text ?? {}]}>{total.label}</Text>
          {withHours && <Text style={[styles.cell, styles.hours]} />}
          {withHours && <Text style={[styles.cell, styles.rate]} />}
          <Text style={[styles.cell, styles.bold, styles.amt, text ?? {}]}>{formatMoney(total.current)}</Text>
          <Text style={[styles.cellLast, styles.bold, styles.amt, text ?? {}]}>{formatMoney(total.ytd)}</Text>
        </View>
      )}
    </View>
  );
}

function StubPage({ stub, printedAt }: { stub: PayStub; printedAt: string }) {
  const period = `${formatDate(stub.periodStart)} – ${formatDate(stub.periodEnd)}`;
  const comments: string[] = [];
  if (stub.exemptions.length > 0) comments.push(`Not deducted this period: ${stub.exemptions.join(", ")}.`);
  if (stub.chequePortion > 0) comments.push(`Cheque portion: ${formatMoney(stub.chequePortion)}.`);
  if (stub.cashPaid > 0) comments.push(`Cash paid: ${formatMoney(stub.cashPaid)}.`);
  if (stub.notes) comments.push(stub.notes);

  return (
    <Page size="LETTER" style={styles.page}>
      {/* ---------------- Header ---------------- */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image src={LOGO_PATH} style={styles.logo} />
          <View style={{ flex: 1 }}>
            <Text style={styles.shopName}>{stub.employer.name}</Text>
            {stub.employer.location && stub.employer.location !== stub.employer.name ? (
              <Text style={styles.shopLocation}>{stub.employer.location}</Text>
            ) : null}
            {stub.employer.address ? <Text style={styles.shopMeta}>{stub.employer.address}</Text> : null}
            <View style={styles.shopMetaRow}>
              {stub.employer.phone ? <Text style={styles.shopMetaCell}>{stub.employer.phone}</Text> : null}
              {stub.employer.businessNumber ? (
                <Text style={styles.shopMetaCell}>Business No. {stub.employer.businessNumber}</Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.title}>Pay Statement</Text>
          <Text style={styles.payDateLabel}>Pay date</Text>
          <Text style={styles.payDate}>{stub.payDate ? formatDate(stub.payDate) : "—"}</Text>
          <Text style={styles.metaRight}>Period {period}</Text>
          {stub.chequeNo ? <Text style={styles.metaRight}>Cheque no. {stub.chequeNo}</Text> : null}
          {stub.status ? <Text style={styles.statusBadge}>{stub.status}</Text> : null}
        </View>
      </View>

      {/* ---------------- Employee / period / payment ---------------- */}
      <View style={styles.infoBox}>
        <View style={styles.infoCol}>
          <Text style={styles.boxHeading}>Employee</Text>
          <Text style={styles.employeeName}>{stub.employee.name}</Text>
          <Field label="Employee #" value={stub.employee.code} />
          <Field label="Type" value={stub.employee.type === "management" ? "Management" : "Employee"} />
          <Field label="SIN" value={stub.employee.sin} />
          <Field label="Hire date" value={stub.employee.hireDate ? formatDate(stub.employee.hireDate) : null} />
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.boxHeading}>Pay period</Text>
          <Field label="From" value={formatDate(stub.periodStart)} />
          <Field label="To" value={formatDate(stub.periodEnd)} />
          <Field label="Frequency" value={stub.periodWeeks === 2 ? "Bi-weekly" : "Weekly"} />
          <Field label="Pay date" value={stub.payDate ? formatDate(stub.payDate) : null} />
          <Field label="YTD from" value={formatDate(stub.ytdFrom)} />
        </View>
        <View style={styles.infoColLast}>
          <Text style={styles.boxHeading}>Payment</Text>
          <Field label="Method" value={stub.paymentMethod} />
          <Field label="Cheque no." value={stub.chequeNo} />
          {stub.payments.map((p, i) => (
            <Text key={i} style={[styles.smallMuted, { marginTop: 1 }]}>
              {formatDate(p.date)} · {p.method}
              {p.reference ? ` · ${p.reference}` : ""} · {formatMoney(p.amount)}
            </Text>
          ))}
        </View>
      </View>

      {/* ---------------- Earnings ---------------- */}
      <AmountTable
        heading="Earnings"
        lines={stub.earnings}
        withHours
        total={stub.gross ? { label: "Gross earnings", ...stub.gross } : null}
      />

      {/* ---------------- Deductions + employer | Net pay ---------------- */}
      <View style={styles.twoCol}>
        <View style={styles.leftCol}>
          <AmountTable
            heading="Deductions"
            lines={stub.deductions}
            total={{ label: "Total deductions", ...stub.totalDeductions }}
          />
          {stub.employerContributions.length > 0 && (
            <AmountTable heading="Employer contributions" lines={stub.employerContributions} compact />
          )}
        </View>

        <View style={styles.rightCol}>
          <View style={styles.netBox} wrap={false}>
            <Text style={styles.netHeader}>Net Pay</Text>
            {stub.gross && (
              <View style={styles.netRow}>
                <Text>Gross earnings</Text>
                <Text>{formatMoney(stub.gross.current)}</Text>
              </View>
            )}
            <View style={styles.netRow}>
              <Text>Total deductions</Text>
              <Text>{formatMoney(-stub.totalDeductions.current)}</Text>
            </View>
            {stub.net && (
              <>
                <View style={styles.netEmphasis}>
                  <Text>Net pay</Text>
                  <Text>{formatMoney(stub.net.current)}</Text>
                </View>
                <View style={styles.netRowLast}>
                  <Text style={styles.smallMuted}>Net pay, year to date</Text>
                  <Text style={styles.small}>{formatMoney(stub.net.ytd)}</Text>
                </View>
              </>
            )}
          </View>

          {stub.vacation && (
            <View style={styles.netBox} wrap={false}>
              <Text style={[styles.netHeader, { fontSize: 9 }]}>
                Vacation pay accrued{stub.vacation.ratePct ? ` (${stub.vacation.ratePct})` : ""}
              </Text>
              <View style={styles.netRow}>
                <Text>This period</Text>
                <Text>{formatMoney(stub.vacation.current)}</Text>
              </View>
              <View style={styles.netRowLast}>
                <Text>Year to date</Text>
                <Text>{formatMoney(stub.vacation.ytd)}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ---------------- Notes ---------------- */}
      {comments.length > 0 && (
        <View style={styles.commentsBox} wrap={false}>
          <Text style={styles.commentsLabel}>Notes</Text>
          {comments.map((c, i) => (
            <Text key={i} style={{ marginTop: i === 0 ? 0 : 2 }}>
              {c}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.footer} fixed>
        <Text>Please keep this statement for your records.</Text>
        <Text>Printed {printedAt}</Text>
      </View>
    </Page>
  );
}

/** One PDF, one page per stub. */
export function buildPayStubDoc(stubs: PayStub[], opts: { title?: string } = {}) {
  const printedAt = formatDateTime(new Date());
  return (
    <Document title={opts.title ?? "Pay statements"} author={stubs[0]?.employer.name ?? "Quick Truck Lube"}>
      {stubs.map((stub) => (
        <StubPage key={stub.entryId} stub={stub} printedAt={printedAt} />
      ))}
    </Document>
  );
}
