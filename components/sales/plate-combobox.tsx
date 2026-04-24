"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

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
import { cn } from "@/lib/utils";

export function PlateComboBox({
  value,
  plates,
  onChange,
}: {
  value: string;
  plates: string[];
  onChange: (plate: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const normalized = q.trim().toUpperCase();
  const hasExactMatch = plates.some((p) => p === normalized);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          type="button"
          className="w-full justify-between font-mono uppercase max-w-xs"
        >
          <span className="truncate">
            {value || (plates.length === 0 ? "No plates yet — add one" : "Select a plate…")}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={
              plates.length === 0
                ? "Type the new plate…"
                : "Search or type new plate…"
            }
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            {plates.length === 0 && normalized.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                This customer has no plates saved yet. Type one above to add it.
              </div>
            )}
            <CommandEmpty>No plate found.</CommandEmpty>
            {!hasExactMatch && (
              <CommandGroup>
                <CommandItem
                  value={`__new__${normalized || "_"}`}
                  disabled={normalized.length === 0}
                  onSelect={() => {
                    if (normalized.length === 0) return;
                    onChange(normalized);
                    setOpen(false);
                    setQ("");
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 size-4" />
                  <span>
                    {normalized.length > 0 ? (
                      <>Add new plate: <strong className="font-mono">{normalized}</strong></>
                    ) : (
                      <>Add new plate</>
                    )}
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            {plates.length > 0 && (
              <CommandGroup heading="Saved plates">
                {plates
                  .filter((p) =>
                    normalized.length === 0
                      ? true
                      : p.includes(normalized),
                  )
                  .map((p) => (
                    <CommandItem
                      key={p}
                      value={p}
                      onSelect={() => {
                        onChange(p);
                        setOpen(false);
                        setQ("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          value === p ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="font-mono">{p}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
