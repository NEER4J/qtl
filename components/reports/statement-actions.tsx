"use client";

import { PdfShareActions } from "@/components/pdf/pdf-share-actions";
import { getStatementShareLink } from "@/lib/actions/statements";
import { formatDate, formatMoney } from "@/lib/utils/format";

/**
 * Print, Download and Email for a monthly customer statement (client
 * 2026-10-20) — the same buttons and email dialog as an invoice.
 */
export function StatementActions({
  customerId,
  month,
  monthLabel,
  customerName,
  customerEmail,
  statementDate,
  closingBalance,
  shopName,
}: {
  customerId: string;
  /** YYYY-MM */
  month: string;
  /** "September 2026" */
  monthLabel: string;
  customerName: string;
  customerEmail: string | null;
  /** Last day of the month (YYYY-MM-DD). */
  statementDate: string;
  closingBalance: number;
  shopName: string;
}) {
  return (
    <PdfShareActions
      pdfUrl={`/api/statements/${customerId}/pdf?month=${month}`}
      email={{
        title: `Email the ${monthLabel} statement`,
        defaultTo: customerEmail,
        noAddressHint: "No email on this customer — type one in.",
        linkKey: `${customerId}:${month}`,
        getLink: () => getStatementShareLink(customerId, month),
        subject: `Statement for ${monthLabel} — ${shopName}`,
        body: (link) =>
          [
            `Hello ${customerName},`,
            "",
            `Here is your statement for ${monthLabel}. The balance owing on ${formatDate(statementDate)} was ${formatMoney(closingBalance)}.`,
            "",
            `View or download it here (the link works for ${link.days} days):`,
            link.url,
            "",
            "Thank you for your business,",
            shopName,
          ].join("\n"),
      }}
    />
  );
}
