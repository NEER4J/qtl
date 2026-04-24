"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";

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
import { searchCustomers } from "@/lib/actions/customers";
import type { Customer } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export function CustomerComboBox({
  value,
  onChange,
  onCreateNew,
  onSelectCustomer,
  billingName,
}: {
  /** customer_id or null */
  value: string | null;
  onChange: (id: string | null) => void;
  onCreateNew?: (name: string) => void;
  /** Fires when a concrete customer is picked, so the form can auto-fill details. */
  onSelectCustomer?: (customer: Customer) => void;
  billingName: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [isPending, startTransition] = useTransition();
  const cacheRef = useRef<Map<string, Customer>>(new Map());

  const selected = value ? cacheRef.current.get(value) : null;

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const res = await searchCustomers({ q, limit: 20 });
      if (res.ok) {
        setResults(res.data);
        for (const c of res.data) cacheRef.current.set(c.id, c);
      }
    });
  }, [q, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          type="button"
        >
          <span className="truncate">
            {selected?.billing_name ?? billingName ?? "Search customer…"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or plate…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            <CommandEmpty>
              {isPending ? "Searching…" : "No customer found."}
            </CommandEmpty>
            {onCreateNew && (
              <CommandGroup>
                <CommandItem
                  value={`__create__${q}`}
                  onSelect={() => {
                    onCreateNew(q.trim());
                    setOpen(false);
                  }}
                  className="text-primary"
                >
                  <UserPlus className="mr-2 size-4" />
                  <span>
                    {q.trim().length > 0 ? (
                      <>Add new customer: <strong>{q}</strong></>
                    ) : (
                      <>Add new customer</>
                    )}
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Customers">
              {results.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    cacheRef.current.set(c.id, c);
                    onChange(c.id);
                    onSelectCustomer?.(c);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === c.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <span className="truncate font-medium">{c.billing_name}</span>
                    {c.license_plates?.length ? (
                      <span className="truncate text-xs text-muted-foreground font-mono">
                        {c.license_plates.slice(0, 3).join(", ")}
                      </span>
                    ) : null}
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
