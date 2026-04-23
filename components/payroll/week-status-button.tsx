"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updatePayrollWeekStatus } from "@/lib/actions/payroll";
import type { PayrollWeekStatus } from "@/lib/db/types";

const NEXT: Record<PayrollWeekStatus, { label: string; next: PayrollWeekStatus } | null> = {
  draft: { label: "Approve", next: "approved" },
  approved: { label: "Mark as paid", next: "paid" },
  paid: null,
};

export function WeekStatusButton({
  weekId,
  currentStatus,
}: {
  weekId: string;
  currentStatus: PayrollWeekStatus;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const transition = NEXT[currentStatus];
  if (!transition) return null;

  async function handleClick() {
    setLoading(true);
    const result = await updatePayrollWeekStatus({ id: weekId, status: transition!.next });
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success(`Week marked as ${transition!.next}`);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <Button onClick={handleClick} disabled={loading} size="sm">
      {loading ? "Saving…" : transition.label}
    </Button>
  );
}
