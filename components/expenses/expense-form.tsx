"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyDropdownHint } from "@/components/help/empty-state";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import { ExpenseInput } from "@/lib/schemas/expenses";
import type {
  ExpenseCategory,
  ExpenseSubcategory,
  Location,
  PaymentMode,
  Vendor,
} from "@/lib/db/types";
import { todayISO } from "@/lib/utils/format";

import { VendorComboBox } from "./vendor-combobox";
import { CreateVendorDialog } from "./create-vendor-dialog";
import {
  ExpenseLineItems,
  lineItemsSubTotal,
  type ExpenseLineItem,
} from "./expense-line-items";

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "debit", label: "Debit" },
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "etransfer", label: "E-Transfer" },
  { value: "credit_card", label: "Credit Card" },
];

interface FormValues {
  location_id: string;
  expense_date: string;
  category_id: string;
  subcategory_id: string | null;
  vendor_id: string | null;
  vendor_name_snapshot: string;
  invoice_no: string;
  account_type: string;
  account_number: string;
  contact_no: string;
  email: string;
  sub_total: string;
  hst: string;
  total: string;
  paid_amount: string;
  payment_date: string;
  payment_mode: PaymentMode | "";
  transaction_id: string;
  notes: string;
}

export interface ExpenseFormProps {
  mode: "create" | "edit";
  initial?: Partial<FormValues> & { id?: string };
  locations: Location[];
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
  hstRate: number;
  lockedLocationId?: string | null;
  /** Existing line items (edit mode). */
  initialItems?: ExpenseLineItem[];
}

export function ExpenseForm({
  mode,
  initial,
  locations,
  categories,
  subcategories,
  hstRate,
  lockedLocationId,
  initialItems,
}: ExpenseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createVendorOpen, setCreateVendorOpen] = useState(false);
  const [createVendorName, setCreateVendorName] = useState("");
  const [items, setItems] = useState<ExpenseLineItem[]>(initialItems ?? []);

  const defaults: FormValues = {
    location_id: lockedLocationId ?? initial?.location_id ?? locations[0]?.id ?? "",
    expense_date: initial?.expense_date ?? todayISO(),
    category_id: initial?.category_id ?? "",
    subcategory_id: initial?.subcategory_id ?? null,
    vendor_id: initial?.vendor_id ?? null,
    vendor_name_snapshot: initial?.vendor_name_snapshot ?? "",
    invoice_no: initial?.invoice_no ?? "",
    account_type: initial?.account_type ?? "",
    account_number: initial?.account_number ?? "",
    contact_no: initial?.contact_no ?? "",
    email: initial?.email ?? "",
    sub_total: initial?.sub_total ?? "",
    hst: initial?.hst ?? "",
    total: initial?.total ?? "",
    paid_amount: initial?.paid_amount ?? "",
    payment_date: initial?.payment_date ?? "",
    payment_mode: initial?.payment_mode ?? "",
    transaction_id: initial?.transaction_id ?? "",
    notes: initial?.notes ?? "",
  };

  const form = useForm<FormValues>({ defaultValues: defaults });

  const categoryId = useWatch({ control: form.control, name: "category_id" });
  const subTotalRaw = useWatch({ control: form.control, name: "sub_total" });
  const paidRaw = useWatch({ control: form.control, name: "paid_amount" });

  // When line items exist, they drive the sub-total. Without items the user
  // can still enter sub_total directly (back-compat for expenses without
  // itemised parts).
  useEffect(() => {
    if (items.length === 0) return;
    const sum = lineItemsSubTotal(items);
    form.setValue("sub_total", sum.toFixed(2), { shouldDirty: true });
  }, [items, form]);

  useEffect(() => {
    const n = Number(subTotalRaw);
    if (!Number.isFinite(n) || n <= 0) {
      form.setValue("hst", "");
      form.setValue("total", "");
      return;
    }
    const hst = Math.round(n * hstRate * 100) / 100;
    const total = Math.round((n + hst) * 100) / 100;
    form.setValue("hst", hst.toFixed(2));
    form.setValue("total", total.toFixed(2));
  }, [subTotalRaw, hstRate, form]);

  const subcategoryOptions = useMemo(
    () => subcategories.filter((s) => s.category_id === categoryId && s.active),
    [categoryId, subcategories],
  );

  // If the user switches category, clear subcategory + vendor (vendor may have
  // been scoped to prev category).
  useEffect(() => {
    const cur = form.getValues("subcategory_id");
    if (cur && !subcategoryOptions.some((s) => s.id === cur)) {
      form.setValue("subcategory_id", null);
    }
  }, [subcategoryOptions, form]);

  const applyVendor = (v: Vendor) => {
    form.setValue("vendor_id", v.id);
    form.setValue("vendor_name_snapshot", v.name);
    if (v.contact_no) form.setValue("contact_no", v.contact_no);
    if (v.email) form.setValue("email", v.email);
    if (v.account_no) form.setValue("account_number", v.account_no);
    if (v.account_type) form.setValue("account_type", v.account_type);
  };

  const onSubmit = form.handleSubmit((values) => {
    const cleanItems = items
      .filter((it) => it.description.trim() || it.quantity > 0 || it.unit_cost > 0)
      .map((it) => ({
        part_id: it.part_id,
        vendor_part_id: it.vendor_part_id,
        description: it.description.trim() || "Item",
        quantity: Number(it.quantity) || 0,
        unit_cost: Number(it.unit_cost) || 0,
        last_buying_price_snapshot: it.last_buying_price ?? null,
      }));

    const payload = {
      ...values,
      sub_total: Number(values.sub_total || 0),
      hst: Number(values.hst || 0),
      total: Number(values.total || 0),
      paid_amount: Number(values.paid_amount || 0),
      payment_mode: values.payment_mode === "" ? null : values.payment_mode,
      payment_date: values.payment_date || null,
      items: cleanItems,
    };

    const parsed = ExpenseInput.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        form.setError(path as keyof FormValues, { message: issue.message });
      }
      return;
    }

    startTransition(async () => {
      const res =
        mode === "create"
          ? await createExpense(parsed.data)
          : await updateExpense({ ...parsed.data, id: initial?.id! });
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof FormValues, { message: v[0] });
          }
        }
        return;
      }
      toast.success(mode === "create" ? "Expense recorded" : "Expense updated");
      router.push(`/expenses/${res.data.id}`);
      router.refresh();
    });
  });

  const locationOptions = useMemo(
    () => locations.filter((l) => l.active),
    [locations],
  );

  return (
    <>
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* --------------------------------------------------------------
              Header
          -------------------------------------------------------------- */}
          <section className="rounded-md border p-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Details
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="expense_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    {locationOptions.length === 0 ? (
                      <EmptyDropdownHint
                        message="No shop locations have been added yet."
                        actionLabel="Add a location"
                        href="/settings/locations"
                      />
                    ) : (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!!lockedLocationId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locationOptions.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
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
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Manage
                      </a>
                    </div>
                    {categories.length === 0 ? (
                      <EmptyDropdownHint
                        message="No expense categories have been set up yet."
                        actionLabel="Add categories"
                        href="/settings/categories"
                      />
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subcategory_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-category</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v || null)}
                      value={field.value ?? ""}
                      disabled={subcategoryOptions.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              subcategoryOptions.length
                                ? "Select…"
                                : "Pick a category first"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subcategoryOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* --------------------------------------------------------------
              Vendor
          -------------------------------------------------------------- */}
          <section className="rounded-md border p-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Vendor
            </h2>

            <FormField
              control={form.control}
              name="vendor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor</FormLabel>
                  <FormControl>
                    <VendorComboBox
                      value={field.value}
                      defaultName={form.getValues("vendor_name_snapshot")}
                      categoryId={categoryId || null}
                      onChange={(id) => field.onChange(id)}
                      onSelectVendor={applyVendor}
                      onCreateNew={(name) => {
                        setCreateVendorName(name);
                        form.setValue("vendor_name_snapshot", name);
                        setCreateVendorOpen(true);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="invoice_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice #</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Auto-generated if blank" className="font-mono" />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="account_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account #</FormLabel>
                    <FormControl>
                      <Input {...field} className="font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* --------------------------------------------------------------
              Items — what parts the vendor billed for. Auto-feeds sub_total.
          -------------------------------------------------------------- */}
          <section className="rounded-md border p-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Items
            </h2>
            <ExpenseLineItems items={items} onChange={setItems} />
          </section>

          {/* --------------------------------------------------------------
              Money + Payment
          -------------------------------------------------------------- */}
          <section className="rounded-md border p-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              Amount
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="sub_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Sub Total {items.length > 0 && (
                        <span className="text-xs text-muted-foreground">(from items)</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        readOnly={items.length > 0}
                        className={items.length > 0 ? "bg-muted/50" : undefined}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hst"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HST ({(hstRate * 100).toFixed(0)}%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" readOnly className="bg-muted/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" readOnly className="bg-muted/50 font-semibold" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paid_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment mode</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v as PaymentMode | "")}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="(Outstanding if blank)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_MODES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="transaction_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Auto-generated if blank" className="font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {Number(paidRaw) === 0 && (
              <p className="text-xs text-amber-600">
                No payment recorded — this expense will be marked Outstanding.
              </p>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : mode === "create" ? "Record expense" : "Save changes"}
            </Button>
          </div>
        </form>
      </Form>

      <CreateVendorDialog
        open={createVendorOpen}
        onOpenChange={setCreateVendorOpen}
        defaultName={createVendorName}
        categoryId={categoryId || null}
        onCreated={(v) => {
          applyVendor(v);
          setCreateVendorOpen(false);
        }}
      />
    </>
  );
}
