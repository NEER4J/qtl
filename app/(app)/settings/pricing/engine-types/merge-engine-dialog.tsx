"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Merge } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mergeEngineType } from "@/lib/actions/pricing";
import type { EngineType } from "@/lib/db/types";

import { baseModelName } from "./base-model-name";

function engineLabel(e: EngineType): string {
  return `${e.manufacturer} ${e.model}${e.active ? "" : " (inactive)"}`;
}

/**
 * Offered when deleting an engine is blocked because sales jobs point at it.
 * The duplicate's jobs move to the engine picked here, then the duplicate is
 * deleted. Its filters, manual prices and price-lock rows are dropped, not
 * copied — copying them would change what the kept engine charges.
 */
export function MergeEngineDialog({
  source,
  reason,
  engineTypes,
  onOpenChange,
}: {
  /** The engine whose delete was blocked; null closes the dialog. */
  source: EngineType | null;
  /** The blocked-delete message, which carries the job count. */
  reason: string | null;
  engineTypes: EngineType[];
  onOpenChange: (open: boolean) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [pending, startTransition] = useTransition();

  // Likely matches first: same manufacturer and same base model (the filter
  // variants of that engine), then the rest of that manufacturer, then others.
  const { likely, sameMake, others } = useMemo(() => {
    const buckets: Record<"likely" | "sameMake" | "others", EngineType[]> = {
      likely: [],
      sameMake: [],
      others: [],
    };
    if (!source) return buckets;
    const make = source.manufacturer.trim().toLowerCase();
    const base = baseModelName(source.model).toLowerCase();
    const sorted = engineTypes
      .filter((e) => e.id !== source.id)
      .sort((a, b) => Number(b.active) - Number(a.active));
    for (const e of sorted) {
      if (e.manufacturer.trim().toLowerCase() !== make) buckets.others.push(e);
      else if (baseModelName(e.model).toLowerCase() === base) buckets.likely.push(e);
      else buckets.sameMake.push(e);
    }
    return buckets;
  }, [engineTypes, source]);

  const target = engineTypes.find((e) => e.id === targetId) ?? null;

  const close = (open: boolean) => {
    if (!open) setTargetId("");
    onOpenChange(open);
  };

  const merge = () => {
    if (!source || !target) return;
    startTransition(async () => {
      const res = await mergeEngineType({ target_id: target.id, source_id: source.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const n = res.data.moved_jobs;
      toast.success(
        `Merged into ${target.manufacturer} ${target.model} — ${n} sales job${n === 1 ? "" : "s"} moved`,
      );
      close(false);
    });
  };

  return (
    <Dialog open={source !== null} onOpenChange={close}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Merge {source ? `${source.manufacturer} ${source.model}` : "engine"}
          </DialogTitle>
          <DialogDescription>{reason}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="merge-engine-target">Keep this engine instead</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger id="merge-engine-target">
              <SelectValue placeholder="Pick the engine it duplicates" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {(
                [
                  ["Same engine, other filter variants", likely],
                  [`Other ${source?.manufacturer ?? ""} engines`, sameMake],
                  ["Other manufacturers", others],
                ] as const
              ).map(([label, list]) =>
                list.length === 0 ? null : (
                  <SelectGroup key={label}>
                    <SelectLabel>{label}</SelectLabel>
                    {list.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {engineLabel(e)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Its sales jobs move to the engine you keep, so reports count them there. Those jobs
              will show as last edited today.
            </li>
            <li>
              Its filter set, manual prices and price locks are removed — the kept engine&apos;s
              prices don&apos;t change.
            </li>
            <li>This can&apos;t be undone.</li>
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={merge} disabled={pending || !target}>
            <Merge className="size-4" />
            {pending ? "Merging…" : "Merge and delete duplicate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
