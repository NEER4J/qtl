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
    try {
      const { signedUrl } = await generateInvoicePdf(jobId);
      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = `invoice-${invoiceNo}.pdf`;
      a.target = "_blank";
      a.click();
    } catch {
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
