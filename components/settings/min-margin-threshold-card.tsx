"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateMinMarginAlertPct } from "@/lib/actions/pricing";

export function MinMarginThresholdCard({ initialPct }: { initialPct: number }) {
  const [pct, setPct] = useState(String(initialPct));
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const num = Number(pct);
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      toast.error("Enter a number between 0 and 100");
      return;
    }
    startTransition(async () => {
      const res = await updateMinMarginAlertPct({ pct: num });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Threshold updated");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Margin alert threshold</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Active parts whose margin (list price minus cost minus MHSW) falls below this percentage of the list price are flagged on the Products & Services analytics page. Set to 0 to disable alerts.
        </p>
        <div className="flex items-center gap-2 max-w-xs">
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button size="sm" onClick={save} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
