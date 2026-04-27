// React-PDF invoice template — imported dynamically in lib/actions/invoices.ts
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

const ACCENT = "#1e3a5f";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const styles = StyleSheet.create({
  page: { fontSize: 10, fontFamily: "Helvetica", padding: 40, color: "#111827" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28, alignItems: "flex-start" },
  companyBlock: { gap: 2, flexDirection: "row", alignItems: "center" },
  companyText: { gap: 2, marginLeft: 10 },
  logo: { width: 50, height: 50, objectFit: "contain" },
  companyName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: ACCENT },
  companyMeta: { fontSize: 8, color: MUTED },
  invoiceBlock: { alignItems: "flex-end", gap: 2 },
  invoiceLabel: { fontSize: 18, fontFamily: "Helvetica-Bold", color: ACCENT, letterSpacing: 1 },
  invoiceNo: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  invoiceMeta: { fontSize: 8, color: MUTED },
  divider: { borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  row: { flexDirection: "row", gap: 8, marginBottom: 3 },
  label: { width: 90, color: MUTED },
  value: { flex: 1 },
  mono: { fontFamily: "Courier" },
  amountTable: { borderWidth: 1, borderColor: BORDER, borderRadius: 4 },
  amountRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: BORDER },
  amountRowLast: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 5 },
  amountTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 7, backgroundColor: ACCENT },
  amountTotalLabel: { fontFamily: "Helvetica-Bold", fontSize: 11, color: "#fff" },
  amountTotalValue: { fontFamily: "Helvetica-Bold", fontSize: 11, color: "#fff" },
  statusBadge: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, alignSelf: "flex-start" },
  statusText: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#fff" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 8, color: MUTED },
});

const STATUS_COLORS: Record<string, string> = {
  paid: "#16a34a",
  partial: "#d97706",
  outstanding: "#dc2626",
};

function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

function isoDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "2-digit" });
}

export function buildInvoiceDoc(job: SalesJobDetail) {
  const statusColor = STATUS_COLORS[job.payment_status] ?? MUTED;

  return (
    <Document title={`Invoice #${job.invoice_no}`} author="Quick Truck Lube & Oil">
      <Page size="LETTER" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Image src={LOGO_PATH} style={styles.logo} />
            <View style={styles.companyText}>
              <Text style={styles.companyName}>Quick Truck Lube &amp; Oil</Text>
              <Text style={styles.companyMeta}>{job.location_name ?? ""}</Text>
            </View>
          </View>
          <View style={styles.invoiceBlock}>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceNo}>#{job.invoice_no}</Text>
            <Text style={styles.invoiceMeta}>{isoDate(job.job_date)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To + Job */}
        <View style={{ flexDirection: "row", gap: 24, marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>{job.billing_name}</Text>
            {job.license_plate && <Text style={[styles.mono, { fontSize: 9 }]}>{job.license_plate}</Text>}
            {job.contact_no && <Text>{job.contact_no}</Text>}
            {job.email && <Text>{job.email}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Job Details</Text>
            <View style={styles.row}><Text style={styles.label}>Service</Text><Text style={styles.value}>{job.service_type_name ?? "—"}</Text></View>
            {job.bay_no != null && <View style={styles.row}><Text style={styles.label}>Bay</Text><Text style={styles.value}>{job.bay_no}</Text></View>}
            {job.odometer != null && <View style={styles.row}><Text style={styles.label}>Odometer</Text><Text style={styles.value}>{job.odometer.toLocaleString()} km</Text></View>}
            {job.upper_deck && <View style={styles.row}><Text style={styles.label}>Upper deck</Text><Text style={styles.value}>{job.upper_deck}</Text></View>}
            {job.lower_deck && <View style={styles.row}><Text style={styles.label}>Lower deck</Text><Text style={styles.value}>{job.lower_deck}</Text></View>}
          </View>
        </View>

        {/* Comments */}
        {job.comments && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text>{job.comments}</Text>
          </View>
        )}

        {/* Amounts */}
        <View style={[styles.section, { maxWidth: 260, alignSelf: "flex-end" }]}>
          <View style={styles.amountTable}>
            <View style={styles.amountRow}>
              <Text style={styles.label}>Sub Total</Text>
              <Text>{money(job.sub_total)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.label}>HST (13%)</Text>
              <Text>{money(job.hst)}</Text>
            </View>
            <View style={styles.amountTotalRow}>
              <Text style={styles.amountTotalLabel}>Total</Text>
              <Text style={styles.amountTotalValue}>{money(job.total)}</Text>
            </View>
          </View>

          {job.paid_amount > 0 && (
            <View style={{ marginTop: 8 }}>
              <View style={styles.amountRowLast}>
                <Text style={[styles.label, { color: "#111" }]}>Paid</Text>
                <Text>{money(job.paid_amount)}</Text>
              </View>
              <View style={styles.amountRowLast}>
                <Text style={[styles.label, { fontFamily: "Helvetica-Bold", color: "#111" }]}>Balance due</Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{money(job.outstanding)}</Text>
              </View>
            </View>
          )}

          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{job.payment_status.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Quick Truck Lube &amp; Oil Ltd. · Thank you for your business.
        </Text>
      </Page>
    </Document>
  );
}
