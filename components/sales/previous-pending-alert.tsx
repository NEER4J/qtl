"use client";

import { AlertTriangle, Wallet } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { CustomerOutstanding } from "@/lib/actions/customers";
import { formatDate, formatMoney } from "@/lib/utils/format";

export function PreviousPendingAlert({
  customerId,
  outstanding,
  storeCredit,
}: {
  customerId: string | null;
  /** Loaded by the sales form with the rest of the customer's context (one
   *  action instead of a separate one queued behind it). */
  outstanding: CustomerOutstanding | null;
  /** The balance the sales form already loaded for its payment section. Passed
   *  in rather than fetched again: server actions run one at a time, so a
   *  duplicate read here held up every picker opened after picking a customer.
   *  It's also the figure the payment section offers, which this alert points to. */
  storeCredit: number;
}) {
  // Hidden until this customer's figures arrive. The credit balance lands in
  // the same response, so neither shows a previous customer's numbers.
  if (!customerId || outstanding?.customer_id !== customerId) return null;
  if (outstanding.invoice_count === 0 && storeCredit <= 0) return null;

  return (
    <div className="space-y-2">
      {outstanding.invoice_count > 0 && (
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
