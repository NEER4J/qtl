"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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

type LocRow = {
  account_no: string;
  account_type: string;
  contact_no: string;
  email: string;
  sales_rep_name: string;
  notes: string;
};

const blankLocRow: LocRow = {
  account_no: "",
  account_type: "",
  contact_no: "",
  email: "",
  sales_rep_name: "",
  notes: "",
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
  const [savingLocId, setSavingLocId] = useState<string | null>(null);

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
      // Load per-location data
      (async () => {
        const rows = await getVendorLocations(vendor.id);
        const byLoc: Record<string, LocRow> = {};
        for (const r of rows) {
          byLoc[r.location_id] = {
            account_no: r.account_no ?? "",
            account_type: r.account_type ?? "",
            contact_no: r.contact_no ?? "",
            email: r.email ?? "",
            sales_rep_name: r.sales_rep_name ?? "",
            notes: r.notes ?? "",
          };
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

  const saveLocRow = async (locId: string) => {
    if (!vendor) return;
    const row = locRows[locId] ?? blankLocRow;
    setSavingLocId(locId);
    const res = await upsertVendorLocation({
      vendor_id: vendor.id,
      location_id: locId,
      account_no: row.account_no || null,
      account_type: row.account_type || null,
      contact_no: row.contact_no || null,
      email: row.email || null,
      sales_rep_name: row.sales_rep_name || null,
      notes: row.notes || null,
    });
    setSavingLocId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Location details saved");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
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

        {/* Per-location tabs (item #16) — edit mode only, since they FK to vendor.id */}
        {mode === "edit" && vendor && locations.length > 0 && (
          <div className="mt-6 border-t pt-6">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Per-location details</h3>
              <p className="text-xs text-muted-foreground">
                Override the defaults above for a specific shop. Used by the expense form
                to prefill the right account number.
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
                return (
                  <TabsContent key={loc.id} value={loc.id} className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Account #</label>
                        <Input
                          value={row.account_no}
                          onChange={(e) => updateLocRow(loc.id, { account_no: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Account type</label>
                        <Input
                          value={row.account_type}
                          onChange={(e) => updateLocRow(loc.id, { account_type: e.target.value })}
                        />
                      </div>
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
                          onChange={(e) => updateLocRow(loc.id, { sales_rep_name: e.target.value })}
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
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveLocRow(loc.id)}
                        disabled={savingLocId === loc.id}
                      >
                        {savingLocId === loc.id ? "Saving…" : `Save ${loc.code ?? loc.name} details`}
                      </Button>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
