"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyDropdownHint } from "@/components/help/empty-state";
import { RecurringExpenseInput } from "@/lib/schemas/recurring";
import {
  createRecurringExpense,
  toggleRecurringExpenseActive,
  updateRecurringExpense,
} from "@/lib/actions/recurring";
import type {
  ExpenseCategory,
  Location,
  RecurringExpense,
  Vendor,
} from "@/lib/db/types";
import { todayISO } from "@/lib/utils/tz";

const DOW = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

interface Props {
  locations: Location[];
  categories: ExpenseCategory[];
  vendors: Vendor[];
  existing?: RecurringExpense;
  children: React.ReactNode;
}

export function RecurringExpenseDialog({ locations, categories, vendors, existing, children }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const form = useForm<RecurringExpenseInput>({
    resolver: zodResolver(RecurringExpenseInput),
    defaultValues: existing
      ? {
          location_id: existing.location_id,
          category_id: existing.category_id,
          subcategory_id: existing.subcategory_id ?? undefined,
          vendor_id: existing.vendor_id ?? undefined,
          description: existing.description ?? "",
          amount: existing.amount,
          hst_rate: existing.hst_rate,
          frequency: existing.frequency,
          day_of_month: existing.day_of_month ?? undefined,
          day_of_week: existing.day_of_week ?? undefined,
          start_date: existing.start_date,
          end_date: existing.end_date ?? "",
          notes: existing.notes ?? "",
        }
      : {
          location_id: "",
          category_id: "",
          description: "",
          amount: 0,
          hst_rate: 0.13,
          frequency: "monthly",
          day_of_month: 1,
          start_date: todayISO(),
          notes: "",
        },
  });

  const freq = form.watch("frequency");

  async function onSubmit(values: RecurringExpenseInput) {
    const result = existing
      ? await updateRecurringExpense({ id: existing.id, ...values })
      : await createRecurringExpense(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(existing ? "Updated" : "Created");
    setOpen(false);
    router.refresh();
  }

  async function toggleActive() {
    if (!existing) return;
    const result = await toggleRecurringExpenseActive({ id: existing.id, active: !existing.active });
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success(existing.active ? "Paused" : "Activated");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit recurring expense" : "New recurring expense"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder="e.g. Monthly radio ad" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    {locations.length === 0 ? (
                      <EmptyDropdownHint
                        message="No shop locations yet."
                        actionLabel="Add a location"
                        href="/settings/locations"
                      />
                    ) : (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
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
                        message="No expense categories yet."
                        actionLabel="Add categories"
                        href="/settings/categories"
                      />
                    ) : (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="vendor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor (optional)</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hst_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HST rate</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" max="1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {freq === "weekly" ? (
              <FormField
                control={form.control}
                name="day_of_week"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of week</FormLabel>
                    <Select value={String(field.value ?? 1)} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {DOW.map((d) => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="day_of_month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of month (1–28)</FormLabel>
                    <FormControl><Input type="number" min="1" max="28" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date (optional)</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-between pt-2">
              {existing ? (
                <Button type="button" variant="outline" onClick={toggleActive}>
                  {existing.active ? "Pause" : "Activate"}
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
