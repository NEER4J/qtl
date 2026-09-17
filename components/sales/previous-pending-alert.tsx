"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Wallet } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCustomerOutstanding, type CustomerOutstanding } from "@/lib/actions/customers";
import { formatDate, formatMoney } from "@/lib/utils/format";

export function PreviousPendingAlert({
  customerId,
  storeCredit,
}: {
  customerId: string | null;
  /** The balance the sales form already loaded for its payment section. Passed
   *  in rather than fetched again: server actions run one at a time, so a
   *  duplicate read here held up every picker opened after picking a customer.
   *  It's also the figure the payment section offers, which this alert points to. */
  storeCredit: number;
}) {
  const [outstanding, setOutstanding] = useState<CustomerOutstanding | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setOutstanding(null);
      return;
    }
    setLoading(true);
    getCustomerOutstanding(customerId)
      .then((o) => setOutstanding(o))
      .catch(() => setOutstanding(null))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (!customerId || loading) return null;
  if ((!outstanding || outstanding.invoice_count === 0) && storeCredit <= 0) return null;

  return (
    <div className="space-y-2">
      {outstanding && outstanding.invoice_count > 0 && (
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
      )}
      {storeCredit > 0 && (
        <Alert>
          <Wallet className="size-4" />
          <AlertTitle>Store credit available: {formatMoney(storeCredit)}</AlertTitle>
          <AlertDescription>
            You can apply this on the payment section below when the invoice total is positive.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
