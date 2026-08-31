"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updatePayrollWeekStatus } from "@/lib/actions/payroll";
import type { PayrollWeekStatus } from "@/lib/db/types";

const FORWARD: Record<PayrollWeekStatus, { label: string; next: PayrollWeekStatus } | null> = {
  draft: { label: "Approve", next: "approved" },
  approved: { label: "Mark as paid", next: "paid" },
  paid: null,
};

const ALL: { value: PayrollWeekStatus; label: string; hint: string }[] = [
  { value: "draft", label: "Draft", hint: "Still being worked on" },
  { value: "approved", label: "Approved", hint: "Numbers signed off" },
  { value: "paid", label: "Paid", hint: "Money has gone out" },
];

/**
 * Status control for a pay week. The primary button advances one step; the
 * dropdown can set any status, including moving BACK — a week marked paid by
 * mistake used to be a dead end.
 */
export function WeekStatusButton({
  weekId,
  currentStatus,
}: {
  weekId: string;
  currentStatus: PayrollWeekStatus;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const forward = FORWARD[currentStatus];

  async function setStatus(next: PayrollWeekStatus) {
    if (next === currentStatus) return;
    setLoading(true);
    const result = await updatePayrollWeekStatus({ id: weekId, status: next });
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success(`Week marked as ${next}`);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-1">
      {forward && (
        <Button onClick={() => setStatus(forward.next)} disabled={loading} size="sm">
          {loading ? "Saving…" : forward.label}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading}>
            {forward ? <ChevronDown className="size-4" /> : <><Undo2 className="size-4" /> Change status</>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Set status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ALL.map((s) => (
            <DropdownMenuItem
              key={s.value}
              onSelect={() => setStatus(s.value)}
              disabled={s.value === currentStatus}
            >
              <Check className={s.value === currentStatus ? "size-4" : "size-4 opacity-0"} />
              <div className="flex flex-col">
                <span>{s.label}</span>
                <span className="text-xs text-muted-foreground">{s.hint}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
