"use client";

import { useTransition } from "react";
import { Gift } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { grantFreeOilChange } from "@/lib/actions/customers";

export function GrantFreeOilChangeButton({
  customerId,
  alreadyEligible,
}: {
  customerId: string;
  alreadyEligible: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    if (
      alreadyEligible &&
      !confirm("This customer already has an active free oil-change offer. Extend by another 30 days?")
    ) {
      return;
    }
    startTransition(async () => {
      const res = await grantFreeOilChange({ customer_id: customerId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Free oil-change valid for 30 days");
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={isPending}>
      <Gift className="size-4" />
      {alreadyEligible ? "Extend offer" : "Grant 30-day oil-change"}
    </Button>
  );
}
