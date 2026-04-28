"use client";

import { useEffect, useState, useTransition } from "react";
import { Boxes, ChevronsUpDown } from "lucide-react";

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
import { listPackagesForPicker } from "@/lib/actions/pricing";
import type { PartPackageWithItems } from "@/lib/db/types";

export function PackagePickerButton({
  onSelect,
}: {
  onSelect: (pkg: PartPackageWithItems) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PartPackageWithItems[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const data = await listPackagesForPicker(q);
      setResults(data);
    });
  }, [q, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" role="combobox" aria-expanded={open}>
          <Boxes className="size-4" /> Add package
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[420px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search package name…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            <CommandEmpty>{isPending ? "Searching…" : "No matching packages."}</CommandEmpty>
            <CommandGroup>
              {results.map((pkg) => (
                <CommandItem
                  key={pkg.id}
                  value={pkg.id}
                  onSelect={() => {
                    onSelect(pkg);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex flex-col items-start gap-0.5"
                >
                  <div className="font-medium">{pkg.name}</div>
                  <div className="text-xs text-muted-foreground truncate w-full">
                    {pkg.items.length === 0
                      ? "(empty package)"
                      : pkg.items
                          .map(
                            (it) =>
                              `${Number(it.quantity)}× ${it.part.brand} ${it.part.part_number}`,
                          )
                          .join(", ")}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
