"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { generateInvoicePdf } from "@/lib/actions/invoices";

export function DownloadInvoiceButton({
  jobId,
  invoiceNo,
}: {
  jobId: string;
  invoiceNo: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    // Open the tab while the click still counts as the user's: opening it
    // after the PDF is made was blocked as a pop-up.
    const tab = window.open("about:blank", "_blank");
    try {
      const { signedUrl } = await generateInvoicePdf(jobId);
      if (tab && !signedUrl.startsWith("data:")) {
        tab.location.href = signedUrl;
      } else {
        tab?.close();
        const a = document.createElement("a");
        a.href = signedUrl;
        a.download = `invoice-${invoiceNo}.pdf`;
        a.click();
      }
    } catch {
      tab?.close();
      toast.error("Failed to generate invoice PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={loading}>
      <FileDown className="size-4" />
      {loading ? "Generating…" : "Download PDF"}
    </Button>
  );
}
