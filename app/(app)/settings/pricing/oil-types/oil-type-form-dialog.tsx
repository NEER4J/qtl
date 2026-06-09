"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createOilType, updateOilType } from "@/lib/actions/pricing";
import type { OilType } from "@/lib/db/types";

type FormValues = {
  code: string;
  name: string;
  is_base: boolean;
  bulk_cost_per_litre: string;
  gallon_cost_per_litre: string;
  litres_per_gallon: string;
  is_taxable: boolean;
  is_engine_oil: boolean;
  sort_order: string;
  active: boolean;
};

const blank: FormValues = {
  code: "",
  name: "",
  is_base: false,
  bulk_cost_per_litre: "0",
  gallon_cost_per_litre: "0",
  litres_per_gallon: "4.546",
  is_taxable: true,
  is_engine_oil: true,
  sort_order: "100",
  active: true,
};

export function OilTypeFormDialog({
  open,
  onOpenChange,
  mode,
  oilType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  oilType?: OilType;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: blank });

  useEffect(() => {
    if (!open) return;
    form.reset(
      mode === "edit" && oilType
        ? {
            code: oilType.code,
            name: oilType.name,
            is_base: oilType.is_base,
            bulk_cost_per_litre: String(oilType.bulk_cost_per_litre),
            gallon_cost_per_litre: String(oilType.gallon_cost_per_litre),
            litres_per_gallon: String(oilType.litres_per_gallon),
            is_taxable: oilType.is_taxable,
            is_engine_oil: oilType.is_engine_oil,
            sort_order: String(oilType.sort_order),
            active: oilType.active,
          }
        : blank,
    );
  }, [open, mode, oilType, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = {
        code: values.code.toUpperCase().trim(),
        name: values.name.trim(),
        is_base: values.is_base,
        bulk_cost_per_litre: Number(values.bulk_cost_per_litre),
        gallon_cost_per_litre: Number(values.gallon_cost_per_litre),
        litres_per_gallon: Number(values.litres_per_gallon),
        is_taxable: values.is_taxable,
        is_engine_oil: values.is_engine_oil,
        sort_order: Number(values.sort_order),
        active: values.active,
      };
      const res =
        mode === "create"
          ? await createOilType(payload)
          : await updateOilType({ ...payload, id: oilType!.id });
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof FormValues, { message: v.join(", ") });
          }
        }
        return;
      }
      toast.success(mode === "create" ? "Oil type created" : "Oil type updated");
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New oil type" : "Edit oil type"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="15W40"
                        maxLength={30}
                        className="uppercase"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sort_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort order</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Delo 400 LE 15W40" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="bulk_cost_per_litre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bulk $ / litre *</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.0001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gallon_cost_per_litre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gallon $ / gallon *</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.0001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="litres_per_gallon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Litres per gallon *</FormLabel>
                  <FormControl>
                    <Input type="number" min="0.1" step="0.001" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    4.546 = Imperial gallon, 3.785 = US gallon, 4.000 = metric. Used to convert
                    the per-gallon price into a per-litre rate when pricing oil-change jobs.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_base"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <div className="leading-none">
                    <FormLabel className="cursor-pointer">Base grade</FormLabel>
                    <FormDescription className="text-xs">Typically 15W40. Only mark one oil as base.</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_taxable"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <div className="leading-none">
                    <FormLabel className="cursor-pointer">Taxable (gallon)</FormLabel>
                    <FormDescription className="text-xs">
                      When checked, gallon oil sales of this grade attract HST. The price grid shows pre- and post-tax columns.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_engine_oil"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <div className="leading-none">
                    <FormLabel className="cursor-pointer">Engine oil</FormLabel>
                    <FormDescription className="text-xs">
                      When checked, this grade appears in the Oil-change price grid. Uncheck for coolant / transmission / differential fluids.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {mode === "edit" && (
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Active</FormLabel>
                  </FormItem>
                )}
              />
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
