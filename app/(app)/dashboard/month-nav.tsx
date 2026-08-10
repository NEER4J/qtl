"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return format(d, "yyyy-MM");
}

export function MonthNav({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentMonth = format(new Date(), "yyyy-MM");

  const setMonth = (value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === currentMonth) next.delete("month");
    else next.set("month", value);
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9"
        disabled={isPending}
        onClick={() => setMonth(shiftMonth(month, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Input
        type="month"
        className="h-9 w-[165px]"
        value={month}
        max={currentMonth}
        disabled={isPending}
        onChange={(e) => e.target.value && setMonth(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9"
        disabled={isPending || month >= currentMonth}
        onClick={() => setMonth(shiftMonth(month, 1))}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </Button>
      {month !== currentMonth && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => setMonth(currentMonth)}
        >
          Current month
        </Button>
      )}
    </div>
  );
}
