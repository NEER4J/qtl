"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { CustomerComboBox } from "@/components/sales/customer-combobox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Optional customer filter (?customer_id=), next to the shared date/location filters. */
export function CustomerFilter({
  customerId,
  customerName,
}: {
  customerId: string | null;
  customerName: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const set = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("customer_id", id);
    else next.delete("customer_id");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex w-72 flex-col gap-1">
        <Label className="text-xs">Customer</Label>
        <CustomerComboBox value={customerId} billingName={customerName ?? "All customers"} onChange={set} />
      </div>
      {customerId && (
        <Button type="button" variant="ghost" size="sm" onClick={() => set(null)} disabled={isPending}>
          <X className="size-4" /> All customers
        </Button>
      )}
    </div>
  );
}
