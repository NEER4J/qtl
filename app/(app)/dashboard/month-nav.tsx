"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DashboardRange = "3m" | "6m" | "12m";

const RANGES: { value: DashboardRange; label: string }[] = [
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "12m", label: "1Y" },
];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return format(d, "yyyy-MM");
}

export function MonthNav({ month, range }: { month: string; range: DashboardRange | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentMonth = format(new Date(), "yyyy-MM");

  const navigate = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    mutate(next);
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  const setMonth = (value: string) =>
    navigate((p) => {
      p.delete("range");
      if (!value || value === currentMonth) p.delete("month");
      else p.set("month", value);
    });

  const setRange = (value: DashboardRange) =>
    navigate((p) => {
      p.delete("month");
      // Clicking the active preset toggles back to the current month.
      if (range === value) p.delete("range");
      else p.set("range", value);
    });

  return (
    <div className="flex flex-wrap items-center gap-1">
      <div className="flex items-center rounded-md border p-0.5 mr-1">
        {RANGES.map((r) => (
          <Button
            key={r.value}
            type="button"
            variant={range === r.value ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2.5"
            disabled={isPending}
            onClick={() => setRange(r.value)}
          >
            {r.label}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9"
        disabled={isPending}
        onClick={() => setMonth(shiftMonth(range ? currentMonth : month, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Input
        type="month"
        className={`h-9 w-[165px] ${range ? "opacity-60" : ""}`}
        value={range ? currentMonth : month}
        max={currentMonth}
        disabled={isPending}
        onChange={(e) => e.target.value && setMonth(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9"
        disabled={isPending || range !== null || month >= currentMonth}
        onClick={() => setMonth(shiftMonth(month, 1))}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </Button>
      {(range !== null || month !== currentMonth) && (
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
