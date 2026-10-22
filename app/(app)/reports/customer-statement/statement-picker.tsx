"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { CustomerComboBox } from "@/components/sales/customer-combobox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Pick the customer and the month; both live in the URL so the page can be linked to. */
export function StatementPicker({
  customerId,
  customerName,
  month,
  months,
}: {
  customerId: string | null;
  customerName: string | null;
  month: string;
  /** Newest first: { value: "2026-09", label: "September 2026" }. */
  months: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const go = (id: string | null, m: string) => {
    const params = new URLSearchParams();
    if (id) params.set("customer_id", id);
    params.set("month", m);
    startTransition(() => router.push(`/reports/customer-statement?${params.toString()}`));
  };

  return (
    <div className="flex flex-wrap items-end gap-3 print:hidden">
      <div className="flex w-full max-w-sm flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Customer</Label>
        <CustomerComboBox
          value={customerId}
          billingName={customerName ?? ""}
          onChange={(id) => go(id, month)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Month</Label>
        <Select value={month} onValueChange={(m) => go(customerId, m)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isPending && <span className="pb-2 text-xs text-muted-foreground">Loading…</span>}
    </div>
  );
}
