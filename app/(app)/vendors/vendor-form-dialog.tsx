"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createVendor,
  getVendorLocations,
  listVendorLocationAccounts,
  replaceVendorLocationAccounts,
  updateVendor,
  upsertVendorLocation,
} from "@/lib/actions/vendors";
import { CreateVendorInput } from "@/lib/schemas/vendors";
import type { ExpenseCategory, Location, Vendor } from "@/lib/db/types";

const NO_CATEGORY = "__none__";

type FormValues = {
  code: string;
  name: string;
  contact_no: string;
  email: string;
  account_no: string;
  account_type: string;
  category_id: string;
  notes: string;
};

type AccountRow = {
  label: string;
  account_no: string;
  account_type: string;
  is_default: boolean;
};

type LocRow = {
  contact_no: string;
  email: string;
  sales_rep_name: string;
  notes: string;
  accounts: AccountRow[];
};

const blankLocRow: LocRow = {
  contact_no: "",
  email: "",
  sales_rep_name: "",
  notes: "",
  accounts: [],
};

const blankAccount: AccountRow = {
  label: "",
  account_no: "",
  account_type: "",
  is_default: false,
};

export function VendorFormDialog({
  open,
  onOpenChange,
  mode,
  vendor,
  categories,
  locations = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  vendor?: Vendor;
  categories: ExpenseCategory[];
  locations?: Location[];
}) {
  const [isPending, startTransition] = useTransition();
  const [locRows, setLocRows] = useState<Record<string, LocRow>>({});

  const form = useForm<FormValues>({
    defaultValues: {
      code: "",
      name: "",
      contact_no: "",
      email: "",
      account_no: "",
      account_type: "",
      category_id: NO_CATEGORY,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && vendor) {
      form.reset({
        code: vendor.code ?? "",
        name: vendor.name,
        contact_no: vendor.contact_no ?? "",
        email: vendor.email ?? "",
        account_no: vendor.account_no ?? "",
        account_type: vendor.account_type ?? "",
        category_id: vendor.category_id ?? NO_CATEGORY,
        notes: vendor.notes ?? "",
      });
      // Load per-location data + the accounts list for each location.
      (async () => {
        const [rows, accounts] = await Promise.all([
          getVendorLocations(vendor.id),
          listVendorLocationAccounts(vendor.id),
        ]);
        const byLoc: Record<string, LocRow> = {};
        for (const r of rows) {
          byLoc[r.location_id] = {
            contact_no: r.contact_no ?? "",
            email: r.email ?? "",
            sales_rep_name: r.sales_rep_name ?? "",
            notes: r.notes ?? "",
            accounts: [],
          };
        }
        for (const a of accounts) {
          if (!byLoc[a.location_id]) byLoc[a.location_id] = { ...blankLocRow, accounts: [] };
          byLoc[a.location_id].accounts.push({
            label: a.label ?? "",
            account_no: a.account_no ?? "",
            account_type: a.account_type ?? "",
            is_default: a.is_default,
          });
        }
        setLocRows(byLoc);
      })();
    } else {
      form.reset({
        code: "",
        name: "",
        contact_no: "",
        email: "",
        account_no: "",
        account_type: "",
        category_id: NO_CATEGORY,
        notes: "",
      });
      setLocRows({});
    }
  }, [open, mode, vendor, form]);

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      code: values.code || null,
      name: values.name,
      contact_no: values.contact_no || null,
      email: values.email || null,
      account_no: values.account_no || null,
      account_type: values.account_type || null,
      category_id:
        values.category_id && values.category_id !== NO_CATEGORY
          ? values.category_id
          : null,
      notes: values.notes || null,
    };

    const parsed = CreateVendorInput.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[issue.path.length - 1]?.toString();
        if (path) form.setError(path as keyof FormValues, { message: issue.message });
      }
      return;
    }

    startTransition(async () => {
      const res =
        mode === "create"
          ? await createVendor(parsed.data)
          : await updateVendor({ ...parsed.data, id: vendor!.id });

      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, msgs] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof FormValues, { message: msgs[0] });
          }
        }
        return;
      }

      // Persist per-location details + accounts for every location that has any
      // data. Works the same on create (vendor id comes back here) and edit.
      const vendorId = res.data.id;
      for (const loc of locations) {
        const row = locRows[loc.id];
        if (!row) continue;
        const accts = (row.accounts ?? []).filter(
          (a) => a.account_no || a.account_type || a.label,
        );
        const hasContact =
          !!row.contact_no || !!row.email || !!row.sales_rep_name || !!row.notes;
        if (accts.length === 0 && !hasContact) continue;

        if (hasContact) {
          const lr = await upsertVendorLocation({
            vendor_id: vendorId,
            location_id: loc.id,
            account_no: null,
            account_type: null,
            contact_no: row.contact_no || null,
            email: row.email || null,
            sales_rep_name: row.sales_rep_name || null,
            notes: row.notes || null,
          });
          if (!lr.ok) {
            toast.error(`${loc.code ?? loc.name}: ${lr.error}`);
            return;
          }
        }

        const ar = await replaceVendorLocationAccounts({
          vendor_id: vendorId,
          location_id: loc.id,
          accounts: accts.map((a) => ({
            label: a.label || null,
            account_no: a.account_no || null,
            account_type: a.account_type || null,
            is_default: a.is_default,
          })),
        });
        if (!ar.ok) {
          toast.error(`${loc.code ?? loc.name}: ${ar.error}`);
          return;
        }
      }

      toast.success(mode === "create" ? "Vendor created" : "Vendor updated");
      onOpenChange(false);
    });
  });

  const updateLocRow = (locId: string, patch: Partial<LocRow>) => {
    setLocRows((prev) => ({
      ...prev,
      [locId]: { ...(prev[locId] ?? blankLocRow), ...patch },
    }));
  };

  const getAccounts = (locId: string): AccountRow[] =>
    locRows[locId]?.accounts ?? [];

  const setAccounts = (locId: string, accounts: AccountRow[]) =>
    updateLocRow(locId, { accounts });

  const addAccount = (locId: string) => {
    const current = getAccounts(locId);
    setAccounts(locId, [
      ...current,
      { ...blankAccount, is_default: current.length === 0 },
    ]);
  };

  const updateAccount = (locId: string, idx: number, patch: Partial<AccountRow>) => {
    const current = getAccounts(locId);
    setAccounts(
      locId,
      current.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    );
  };

  const removeAccount = (locId: string, idx: number) => {
    const current = getAccounts(locId).filter((_, i) => i !== idx);
    // Keep a default selected if any remain.
    if (current.length > 0 && !current.some((a) => a.is_default)) {
      current[0]!.is_default = true;
    }
    setAccounts(locId, current);
  };

  const setDefaultAccount = (locId: string, idx: number) => {
    const current = getAccounts(locId).map((a, i) => ({
      ...a,
      is_default: i === idx,
    }));
    setAccounts(locId, current);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New vendor" : "Edit vendor"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Add a new vendor." : "Update vendor details."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor code</FormLabel>
                  <FormControl>
                    <Input placeholder="Auto-generated if blank" className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="TD Bank" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Category</FormLabel>
                    <a
                      href="/settings/categories"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Manage categories
                    </a>
                  </div>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default phone</FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="billing@td.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="account_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default account #</FormLabel>
                    <FormControl>
                      <Input placeholder="123-456-78" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="account_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account type</FormLabel>
                    <FormControl>
                      <Input placeholder="Chequing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Per-location details (item #16). Shown on create AND edit; saved
                together with the vendor when you click Create / Save. */}
            {locations.length > 0 && (
              <div className="mt-2 border-t pt-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold">Per-location details</h3>
                  <p className="text-xs text-muted-foreground">
                    Override the defaults above for a specific shop, and add one or more
                    accounts per location. The expense form uses these to fill the right
                    account.
                  </p>
                </div>
                <Tabs defaultValue={locations[0]?.id}>
                  <TabsList className="w-full justify-start">
                    {locations.map((loc) => (
                      <TabsTrigger key={loc.id} value={loc.id}>
                        {loc.code ?? loc.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {locations.map((loc) => {
                    const row = locRows[loc.id] ?? blankLocRow;
                    const accounts = row.accounts ?? [];
                    return (
                      <TabsContent key={loc.id} value={loc.id} className="mt-4 space-y-4">
                        {/* Accounts list */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold">Accounts</label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addAccount(loc.id)}
                            >
                              Add account
                            </Button>
                          </div>
                          {accounts.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No accounts yet. Add one to make it pickable on expenses for
                              this location.
                            </p>
                          ) : (
                            accounts.map((acc, idx) => (
                              <div
                                key={idx}
                                className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-end gap-2 rounded-md border p-2"
                              >
                                <div>
                                  <label className="text-xs text-muted-foreground">Label</label>
                                  <Input
                                    value={acc.label}
                                    placeholder="Parts a/c"
                                    onChange={(e) =>
                                      updateAccount(loc.id, idx, { label: e.target.value })
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">Account #</label>
                                  <Input
                                    value={acc.account_no}
                                    onChange={(e) =>
                                      updateAccount(loc.id, idx, { account_no: e.target.value })
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">Type</label>
                                  <Input
                                    value={acc.account_type}
                                    placeholder="Chequing"
                                    onChange={(e) =>
                                      updateAccount(loc.id, idx, { account_type: e.target.value })
                                    }
                                  />
                                </div>
                                <label className="flex h-9 items-center gap-1 text-xs">
                                  <input
                                    type="radio"
                                    name={`default-${loc.id}`}
                                    checked={acc.is_default}
                                    onChange={() => setDefaultAccount(loc.id, idx)}
                                  />
                                  Default
                                </label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeAccount(loc.id, idx)}
                                  aria-label="Remove account"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Per-location contact */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Phone</label>
                            <PhoneInput
                              value={row.contact_no}
                              onChange={(v) => updateLocRow(loc.id, { contact_no: v })}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Email</label>
                            <Input
                              type="email"
                              value={row.email}
                              onChange={(e) => updateLocRow(loc.id, { email: e.target.value })}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-muted-foreground">Sales rep name</label>
                            <Input
                              value={row.sales_rep_name}
                              onChange={(e) =>
                                updateLocRow(loc.id, { sales_rep_name: e.target.value })
                              }
                              placeholder="e.g. Jane Doe"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-muted-foreground">Notes</label>
                            <Textarea
                              rows={2}
                              value={row.notes}
                              onChange={(e) => updateLocRow(loc.id, { notes: e.target.value })}
                            />
                          </div>
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : mode === "create" ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
