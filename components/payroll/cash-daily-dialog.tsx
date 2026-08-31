"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
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
import { PayrollCashDailyInput } from "@/lib/schemas/payroll";
import { deleteCashDaily, upsertCashDaily } from "@/lib/actions/payroll";
import { formatDate, formatMoney } from "@/lib/utils/format";
import type { PayrollCashDaily } from "@/lib/db/types";

interface Props {
  entryId: string;
  weekStart: string;
  /** Days already logged for this entry — editable/removable from here. */
  days?: PayrollCashDaily[];
  children: React.ReactNode;
}

export function CashDailyDialog({ entryId, weekStart, days = [], children }: Props) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  const blank: PayrollCashDailyInput = {
    payroll_entry_id: entryId,
    day: weekStart,
    amount: 0,
    notes: "",
  };

  const form = useForm<PayrollCashDailyInput>({
    resolver: zodResolver(PayrollCashDailyInput),
    defaultValues: blank,
  });

  async function onSubmit(values: PayrollCashDailyInput) {
    const result = await upsertCashDaily(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Cash entry saved");
    form.reset(blank);
    router.refresh();
  }

  async function onDelete(id: string) {
    setBusyId(id);
    const result = await deleteCashDaily({ id });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Cash day removed");
      router.refresh();
    }
    setBusyId(null);
  }

  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Daily cash entries</DialogTitle>
        </DialogHeader>

        {sorted.length > 0 && (
          <div className="rounded-md border divide-y">
            {sorted.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <button
                  type="button"
                  className="flex-1 text-left hover:underline"
                  onClick={() =>
                    form.reset({
                      payroll_entry_id: entryId,
                      day: d.day,
                      amount: d.amount,
                      notes: d.notes ?? "",
                    })
                  }
                >
                  <span className="text-muted-foreground">{formatDate(d.day)}</span>{" "}
                  <span className="font-medium tabular-nums">{formatMoney(d.amount)}</span>
                  {d.notes ? <span className="text-xs text-muted-foreground"> · {d.notes}</span> : null}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive"
                  disabled={busyId === d.id}
                  onClick={() => onDelete(d.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <p className="px-3 py-1.5 text-xs text-muted-foreground">
              Click a day to load it below and correct it.
            </p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="day"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save day"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
