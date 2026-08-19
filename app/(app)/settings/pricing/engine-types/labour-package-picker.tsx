"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setEngineLabourPackage, type LabourPackageOption } from "@/lib/actions/pricing";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils/format";

// Words that appear in almost every engine and package name — scoring on them
// would rank every "… With Fleetguard Filter" package against every engine.
const STOPWORDS = new Set(["with", "filter", "and", "the", "series", "engine"]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/**
 * How close a package name is to the engine name. Used only to float the likely
 * package to the top of the list — the admin still picks, because the names are
 * too inconsistent to match automatically (see migration 0130).
 */
function similarity(engineName: string, packageName: string): number {
  const a = tokens(engineName);
  const b = new Set(tokens(packageName));
  let score = 0;
  for (const t of a) {
    if (b.has(t)) score += 2;
    // "C10" vs "10", "5.9L" vs "5.9" — the same number written differently.
    else if ([...b].some((x) => x.replace(/[^0-9.]/g, "") === t.replace(/[^0-9.]/g, "") && /\d/.test(t))) {
      score += 1;
    }
  }
  return score;
}

export function LabourPackagePicker({
  engineId,
  engineName,
  value,
  packages,
}: {
  engineId: string;
  engineName: string;
  value: string | null;
  packages: LabourPackageOption[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => packages.find((p) => p.id === value) ?? null,
    [packages, value],
  );

  const { suggested, rest } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = packages.filter((p) => p.active || p.id === value);
    if (q) {
      return {
        suggested: [],
        rest: base.filter((p) => p.name.toLowerCase().includes(q)),
      };
    }
    const scored = base
      .map((p) => ({ p, score: similarity(engineName, p.name) }))
      .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
    const top = scored.filter((s) => s.score >= 4).slice(0, 5);
    const topIds = new Set(top.map((s) => s.p.id));
    return {
      suggested: top.map((s) => s.p),
      rest: base.filter((p) => !topIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [packages, query, engineName, value]);

  const choose = (packageId: string | null) => {
    setOpen(false);
    startTransition(async () => {
      const res = await setEngineLabourPackage({ id: engineId, labour_package_id: packageId });
      if (!res.ok) toast.error(res.error);
      else toast.success(packageId ? "Labour package linked" : "Labour package cleared");
    });
  };

  const renderItem = (p: LabourPackageOption) => (
    <CommandItem key={p.id} value={p.id} onSelect={() => choose(p.id)}>
      <Check className={cn("mr-2 size-4 shrink-0", value === p.id ? "opacity-100" : "opacity-0")} />
      <span className="flex-1 truncate">{p.name}</span>
      <span className="ml-2 shrink-0 tabular-nums text-xs text-muted-foreground">
        {formatMoney(p.labor_selling_price)}
        {p.active ? "" : " · inactive"}
      </span>
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          size="sm"
          type="button"
          disabled={pending}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground italic")}>
            {pending ? "Saving…" : selected ? selected.name : "Not linked"}
          </span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search packages…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-6 text-center text-sm text-muted-foreground">
                No packages match that search.
              </div>
            </CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => choose(null)}>
                <Check className={cn("mr-2 size-4", value === null ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground italic">Not linked</span>
              </CommandItem>
            </CommandGroup>
            {suggested.length > 0 && (
              <CommandGroup heading="Likely match">{suggested.map(renderItem)}</CommandGroup>
            )}
            {rest.length > 0 && (
              <CommandGroup heading={suggested.length > 0 ? "All packages" : undefined}>
                {rest.map(renderItem)}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
