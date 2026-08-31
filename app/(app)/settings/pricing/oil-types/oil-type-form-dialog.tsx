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
import type { OilGroup, OilType } from "@/lib/db/types";

type FormValues = {
  code: string;
  name: string;
  is_base: boolean;
  oil_group_id: string;
  bulk_cost_per_litre: string;
  gallon_cost_per_litre: string;
  litres_per_gallon: string;
  is_taxable: boolean;
  is_engine_oil: boolean;
  active: boolean;
};

const blank: FormValues = {
  code: "",
  name: "",
  is_base: false,
  oil_group_id: "",
  bulk_cost_per_litre: "0",
  gallon_cost_per_litre: "0",
  litres_per_gallon: "4.546",
  is_taxable: true,
  is_engine_oil: true,
  active: true,
};

export function OilTypeFormDialog({
  open,
  onOpenChange,
  mode,
  oilType,
  oilGroups = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  oilType?: OilType;
  /** Groups this grade can be priced by. Empty until migration 0133. */
  oilGroups?: OilGroup[];
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
            oil_group_id: oilType.oil_group_id ?? "",
            bulk_cost_per_litre: String(oilType.bulk_cost_per_litre),
            gallon_cost_per_litre: String(oilType.gallon_cost_per_litre),
            litres_per_gallon: String(oilType.litres_per_gallon),
            is_taxable: oilType.is_taxable,
            is_engine_oil: oilType.is_engine_oil,
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
        // Not edited here any more (oil groups replaced it), but the flag is
        // still the fallback for grades in no group and UpdateOilTypeInput
        // defaults it to false — so send the value the oil already has, or
        // ticking any other field would silently clear the base grade.
        is_base: mode === "edit" ? (oilType?.is_base ?? false) : false,
        oil_group_id: values.oil_group_id || null,
        bulk_cost_per_litre: Number(values.bulk_cost_per_litre),
        gallon_cost_per_litre: Number(values.gallon_cost_per_litre),
        litres_per_gallon: Number(values.litres_per_gallon),
        is_taxable: values.is_taxable,
        is_engine_oil: values.is_engine_oil,
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

            {oilGroups.length === 0 ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Oil group</span> — no groups exist
                yet, so this grade is charged at the single base grade&apos;s rate on a sales
                line. Create one under Settings → Pricing → Oil groups.
              </div>
            ) : (
              <FormField
                control={form.control}
                name="oil_group_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Oil group</FormLabel>
                    <FormControl>
                      <select
                        className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      >
                        <option value="">No group — use the base grade</option>
                        {oilGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                            {g.bulk_price_per_litre != null
                              ? ` — $${Number(g.bulk_price_per_litre).toFixed(2)}/L`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormDescription className="text-xs">
                      The base price an oil line of this grade is charged at on a sales job. The
                      two cost fields above stay the shop&apos;s own cost and are unaffected.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
