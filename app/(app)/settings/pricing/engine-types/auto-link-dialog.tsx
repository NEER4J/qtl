"use client";

import { useMemo, useState, useTransition } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyEngineLabourPackages, type EngineLabourSuggestion } from "@/lib/actions/pricing";
import { formatMoney } from "@/lib/utils/format";

const CONFIDENCE_LABEL: Record<EngineLabourSuggestion["confidence"], string> = {
  exact: "Exact",
  likely: "Likely",
  "tied-identical": "Same either way",
  ambiguous: "Needs your choice",
};

/**
 * Reviews and applies the proposed engine → package links in bulk.
 *
 * Everything proposable is pre-ticked; the rows the matcher can't call are
 * listed underneath, unticked and unselectable, with the packages that fitted
 * so the admin knows what the choice actually is. They set those in the row
 * picker, one at a time.
 */
export function AutoLinkDialog({
  open,
  onOpenChange,
  suggestions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: EngineLabourSuggestion[];
}) {
  const proposable = useMemo(
    () => suggestions.filter((s) => s.suggested_package_id != null),
    [suggestions],
  );
  const undecided = useMemo(
    () => suggestions.filter((s) => s.suggested_package_id == null),
    [suggestions],
  );

  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const selected = proposable.filter((s) => !skipped.has(s.engine_id));

  const toggle = (engineId: string) => {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(engineId)) next.delete(engineId);
      else next.add(engineId);
      return next;
    });
  };

  const apply = () => {
    if (selected.length === 0) return;
    startTransition(async () => {
      const res = await applyEngineLabourPackages({
        links: selected.map((s) => ({
          engine_id: s.engine_id,
          package_id: s.suggested_package_id!,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Linked ${res.data.linked} engine${res.data.linked === 1 ? "" : "s"} to a labour package`,
      );
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link engines to labour packages</DialogTitle>
          <DialogDescription>
            Matched on engine family, filter brand and model number — so a Cat filter never
            picks up a Fleetguard package. Untick anything you don&apos;t want. Labour, fuel
            and grease on the oil pages come from whatever you link here.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto pr-1">
          {proposable.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Every engine that can be matched by name is already linked.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-8 py-2" />
                  <th className="py-2">Engine</th>
                  <th className="py-2">Package</th>
                  <th className="py-2 text-right">Labour</th>
                  <th className="py-2 pl-3">Match</th>
                </tr>
              </thead>
              <tbody>
                {proposable.map((s) => (
                  <tr key={s.engine_id} className="border-b last:border-0">
                    <td className="py-2">
                      <Checkbox
                        checked={!skipped.has(s.engine_id)}
                        onCheckedChange={() => toggle(s.engine_id)}
                        aria-label={`Link ${s.engine_name}`}
                      />
                    </td>
                    <td className="py-2 pr-3 font-medium">{s.engine_name}</td>
                    <td className="py-2 pr-3">{s.suggested_package_name}</td>
                    <td className="py-2 text-right tabular-nums">
                      {s.suggested_labour != null ? formatMoney(s.suggested_labour) : "—"}
                    </td>
                    <td className="py-2 pl-3">
                      <Badge
                        variant={s.confidence === "exact" ? "default" : "secondary"}
                        className="text-[10px]"
                        title={s.reason}
                      >
                        {CONFIDENCE_LABEL[s.confidence]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {undecided.length > 0 && (
            <div className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/40">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {undecided.length} engine{undecided.length === 1 ? "" : "s"} need your choice
              </p>
              <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
                The name doesn&apos;t say which filter is fitted, and the packages that fit
                charge different amounts. Set these in the <strong>Labour package</strong>{" "}
                column — guessing would put the wrong money on the page.
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                {undecided.map((s) => (
                  <li key={s.engine_id}>
                    <span className="font-medium">{s.engine_name}</span>
                    {s.candidates.length > 0 ? (
                      <span className="text-amber-900/80 dark:text-amber-200/80">
                        {" — "}
                        {s.candidates
                          .map((c) => `${c.name} (${formatMoney(c.labor_selling_price)})`)
                          .join(" · ")}
                      </span>
                    ) : (
                      <span className="text-amber-900/80 dark:text-amber-200/80">
                        {" — no package matches this name"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={pending || selected.length === 0}>
            <Wand2 className="size-4" />
            {pending ? "Linking…" : `Link ${selected.length} engine${selected.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
