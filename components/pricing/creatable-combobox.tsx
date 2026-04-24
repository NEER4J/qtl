"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Search, X } from "lucide-react";

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

/**
 * Picker for a free-text string column (e.g. parts.category, parts.brand).
 * Suggests existing values; lets the user pick one or type a new one.
 * The "add new" affordance is always visible as a footer hint so users know
 * the list isn't closed.
 */
export function CreatableCombobox({
  value,
  onChange,
  suggestions,
  placeholder = "Select…",
  searchPlaceholder = "Search or type a new value…",
  emptyLabel = "Nothing yet.",
  addLabel = "Add new",
  allowClear = false,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Label used in the persistent "+ Add new {type}" footer (e.g. "Add category"). */
  addLabel?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((s) => s.toLowerCase().includes(q));
  }, [query, suggestions]);

  const trimmed = query.trim();
  const hasExactMatch = suggestions.some(
    (s) => s.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreate = trimmed.length > 0 && !hasExactMatch;

  const commit = (next: string) => {
    onChange(next);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          type="button"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {allowClear && value && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear"
                className="opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  commit("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    commit("");
                  }
                }}
              >
                <X className="size-4" />
              </span>
            )}
            <ChevronsUpDown className="size-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          {/* Prominent "add new" row when user types something new — shown at the top so
              they see it immediately, before scrolling through the suggestions. */}
          {canCreate && (
            <button
              type="button"
              onClick={() => commit(trimmed)}
              className="flex items-center gap-2 w-full border-b px-3 py-2 text-sm text-left bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <Plus className="size-4 text-primary" />
              <span className="flex-1 truncate">
                {addLabel}: <strong>&ldquo;{trimmed}&rdquo;</strong>
              </span>
              <kbd className="text-[10px] text-muted-foreground">↵</kbd>
            </button>
          )}
          <CommandList>
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                <Search className="size-4" />
                {suggestions.length === 0
                  ? `${emptyLabel} Type to add your first one.`
                  : "No matches. Type to add a new one."}
              </div>
            </CommandEmpty>
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((s) => (
                  <CommandItem key={s} value={s} onSelect={() => commit(s)}>
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === s ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {s}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          {/* Persistent footer so users always know they can add something new. */}
          {!canCreate && suggestions.length > 0 && (
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              Don&apos;t see it? Type above to <span className="text-foreground font-medium">{addLabel.toLowerCase()}</span>.
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
