"use client";

import { useMemo, useState } from "react";
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
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { prefetchPreloadedList, usePreloadedList } from "@/hooks/use-preloaded-list";
import { searchCustomers } from "@/lib/actions/customers";
import type { Customer } from "@/lib/db/types";
import {
  decodeCustomerPicker,
  searchCustomerPicker,
  type CustomerPickerTuple,
} from "@/lib/utils/customer-picker";
import { cn } from "@/lib/utils";

// Every active customer is loaded once (app/api/picker/customers) and searched
// in the browser, so typing never waits on a round trip. The copy is kept for
// the session and refreshed in the background when a picker opens on one
// older than this.
const CUSTOMERS_URL = "/api/picker/customers";
const CUSTOMERS_MAX_AGE_MS = 60_000;
const MAX_VISIBLE = 50;

/** Load the list ahead of the first click (the sales form calls this on mount). */
export function prefetchPickerCustomers(): void {
  prefetchPreloadedList(CUSTOMERS_URL, CUSTOMERS_MAX_AGE_MS);
}

/** What a pick hands the form. The full, current customer row comes with the
 *  customer's sale context (vehicles, credit), never from this list, so a
 *  stale copy can't offer free grease that was already redeemed. */
export type CustomerPick = {
  id: string;
  billing_name: string | null;
  last_or_company: string | null;
};

type Option = CustomerPick & { plates: string[] };

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
  onSelectCustomer?: (customer: CustomerPick) => void;
  billingName: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<CustomerPick | null>(null);

  const list = usePreloadedList<CustomerPickerTuple[]>(CUSTOMERS_URL, {
    open,
    maxAgeMs: CUSTOMERS_MAX_AGE_MS,
  });
  const rows = useMemo(() => (list.data ? decodeCustomerPicker(list.data) : null), [list.data]);
  const local = useMemo(
    () => (rows ? searchCustomerPicker(rows, q, MAX_VISIBLE) : []),
    [rows, q],
  );

  // The server search covers the two gaps: the list hasn't arrived yet, or it
  // has no match, e.g. a customer a colleague added after it loaded. Without
  // the second, the only option left would be "Add new customer", a duplicate.
  const showLocal = rows !== null && (local.length > 0 || !q.trim());
  const remote = useDebouncedSearch<Customer>({
    open: open && !showLocal,
    query: q,
    fetcher: async (query) => {
      const res = await searchCustomers({ q: query, limit: 20 });
      return res.ok ? res.data : [];
    },
  });

  const options: Option[] = showLocal
    ? local
    : remote.searching
      ? []
      : remote.results.map((c) => ({
          id: c.id,
          billing_name: c.billing_name,
          last_or_company: c.last_or_company,
          plates: c.license_plates ?? [],
        }));

  const label = (picked && picked.id === value ? picked.billing_name : null) ?? billingName;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          type="button"
          onPointerEnter={prefetchPickerCustomers}
          onFocus={prefetchPickerCustomers}
        >
          <span className="truncate">{label || "Search customer…"}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by plate, name, VIN or phone…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            <CommandEmpty>
              {!showLocal && remote.searching ? "Searching…" : "No customer found."}
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
              {options.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    const pick = {
                      id: c.id,
                      billing_name: c.billing_name,
                      last_or_company: c.last_or_company,
                    };
                    setPicked(pick);
                    onChange(c.id);
                    onSelectCustomer?.(pick);
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
                    {c.plates.length ? (
                      <span className="truncate text-xs text-muted-foreground font-mono">
                        {c.plates.slice(0, 3).join(", ")}
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
