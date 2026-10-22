"use client";

import { PdfShareActions } from "@/components/pdf/pdf-share-actions";
import { getInvoiceShareLink } from "@/lib/actions/invoices";
import { formatDate, formatMoney } from "@/lib/utils/format";

/**
 * Print, Download and Email for one invoice (client 2026-10-20).
 *
 * Print and Download read the PDF straight from /api/invoices/[id]/pdf — a
 * plain request the browser doesn't treat as a pop-up. Email opens the shop's
 * email app with the message written: to the customer or any other address,
 * with a 30-day link to the PDF. The buttons and dialog are shared with the
 * monthly statement (components/pdf/pdf-share-actions.tsx).
 */
export function InvoiceActions({
  jobId,
  invoiceNo,
  customerEmail,
  billingName,
  jobDate,
  total,
  shopName,
}: {
  jobId: string;
  invoiceNo: string;
  customerEmail: string | null;
  billingName: string;
  jobDate: string;
  total: number;
  shopName: string;
}) {
  return (
    <PdfShareActions
      pdfUrl={`/api/invoices/${jobId}/pdf`}
      email={{
        title: `Email invoice ${invoiceNo}`,
        defaultTo: customerEmail,
        noAddressHint: "No email on this invoice — type one in.",
        linkKey: jobId,
        getLink: () => getInvoiceShareLink(jobId),
        subject: `Invoice ${invoiceNo} — ${shopName}`,
        body: (link) =>
          [
            `Hello ${billingName},`,
            "",
            `Here is your invoice ${invoiceNo} from ${formatDate(jobDate)} for ${formatMoney(total)}.`,
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
