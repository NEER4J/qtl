"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCustomerOutstanding, type CustomerOutstanding } from "@/lib/actions/customers";
import { formatDate, formatMoney } from "@/lib/utils/format";

export function PreviousPendingAlert({ customerId }: { customerId: string | null }) {
  const [outstanding, setOutstanding] = useState<CustomerOutstanding | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setOutstanding(null);
      return;
    }
    setLoading(true);
    getCustomerOutstanding(customerId)
      .then(setOutstanding)
      .catch(() => setOutstanding(null))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (!customerId || loading) return null;
  if (!outstanding || outstanding.invoice_count === 0) return null;

  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertTitle>
        Previous outstanding: {outstanding.invoice_count} invoice
        {outstanding.invoice_count === 1 ? "" : "s"} totalling{" "}
        {formatMoney(outstanding.outstanding_total)}
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1 text-xs">
          {outstanding.recent.map((r) => (
            <li key={r.id} className="font-mono">
              #{r.invoice_no} — {formatDate(r.job_date)} —{" "}
              {formatMoney(r.outstanding)} outstanding
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
