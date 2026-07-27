"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Wallet } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCustomerOutstanding, type CustomerOutstanding } from "@/lib/actions/customers";
import { fetchCustomerCreditBalance } from "@/lib/actions/customer-credits";
import { formatDate, formatMoney } from "@/lib/utils/format";

export function PreviousPendingAlert({ customerId }: { customerId: string | null }) {
  const [outstanding, setOutstanding] = useState<CustomerOutstanding | null>(null);
  const [storeCredit, setStoreCredit] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setOutstanding(null);
      setStoreCredit(0);
      return;
    }
    setLoading(true);
    Promise.all([
      getCustomerOutstanding(customerId),
      fetchCustomerCreditBalance(customerId),
    ])
      .then(([o, credit]) => {
        setOutstanding(o);
        setStoreCredit(credit);
      })
      .catch(() => {
        setOutstanding(null);
        setStoreCredit(0);
      })
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
