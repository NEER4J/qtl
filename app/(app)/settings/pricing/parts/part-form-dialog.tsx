"use client";

import { useEffect, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { CreatableCombobox } from "@/components/pricing/creatable-combobox";
import { ServiceCostCombobox } from "@/components/pricing/service-cost-combobox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPart, updatePart } from "@/lib/actions/pricing";
import type { AdminPartRow, PartCategoryOption } from "@/lib/actions/pricing";
import type { PartMarginType, ServiceCost } from "@/lib/db/types";
import { calculatePartListPrice } from "@/lib/utils/part-pricing";

type FormValues = {
  part_number: string;
  brand: string;
  category_id: string;
  description: string;
  cost: string;
  mhsw_fee: string;
  margin_type: PartMarginType;
  margin_value: string;
  service_cost_id: string | null;
  is_taxable: boolean;
  active: boolean;
};

const blank: FormValues = {
  part_number: "",
  brand: "",
  category_id: "",
  description: "",
  cost: "0",
  mhsw_fee: "0",
  margin_type: "fixed",
  margin_value: "0",
  service_cost_id: null,
  is_taxable: true,
  active: true,
};

export function PartFormDialog({
  open,
  onOpenChange,
  mode,
  part,
  serviceCosts,
  categories,
  brands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  part?: AdminPartRow;
  serviceCosts: ServiceCost[];
  categories: PartCategoryOption[];
  brands: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: blank });
  const [cost = "0", mhswFee = "0", marginType = "fixed", marginValue = "0", categoryId] =
    useWatch({
      control: form.control,
      name: ["cost", "mhsw_fee", "margin_type", "margin_value", "category_id"],
    });

  const calculatedListPrice = calculatePartListPrice({
    cost: Number(cost),
    mhsw_fee: Number(mhswFee),
    margin_type: marginType,
    margin_value: Number(marginValue),
  });

  const selectedCategory = categories.find((c) => c.id === categoryId);

  useEffect(() => {
    if (!open) return;
    form.reset(
      mode === "edit" && part
        ? {
            part_number: part.part_number,
            brand: part.brand,
            category_id: part.category_id,
            description: part.description ?? "",
            cost: String(part.cost),
            mhsw_fee: String(part.mhsw_fee),
            margin_type: part.margin_type,
            margin_value: String(part.margin_value),
            service_cost_id: part.service_cost_id,
            is_taxable: part.is_taxable,
            active: part.active,
          }
        : blank,
    );
  }, [open, mode, part, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = {
        part_number: values.part_number.trim(),
        brand: values.brand.trim(),
        category_id: values.category_id,
        description: values.description.trim() === "" ? null : values.description.trim(),
        cost: Number(values.cost),
        mhsw_fee: Number(values.mhsw_fee),
        margin_type: values.margin_type,
        margin_value: Number(values.margin_value),
        service_cost_id: values.service_cost_id || null,
        is_taxable: values.is_taxable,
        active: values.active,
      };
      const res =
        mode === "create"
          ? await createPart(payload)
          : await updatePart({ ...payload, id: part!.id });
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof FormValues, { message: v.join(", ") });
          }
        }
        return;
      }
      toast.success(mode === "create" ? "Part created" : "Part updated");
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New part" : "Edit part"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="part_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Part number *</FormLabel>
                    <FormControl>
                      <Input placeholder="LF9080" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand *</FormLabel>
                    <FormControl>
                      <CreatableCombobox
                        value={field.value}
                        onChange={field.onChange}
                        suggestions={brands}
                        placeholder="Pick brand or add new"
                        searchPlaceholder="Search brands or type a new one…"
                        emptyLabel="No brands yet."
                        addLabel="Add brand"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{" "}
                          <span className="text-muted-foreground">
                            ({c.unit_of_measure})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCategory && (
                    <FormDescription>
                      Quantities of this part will be shown in <strong>{selectedCategory.unit_of_measure}</strong>.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost *</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mhsw_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MHSW fee</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="margin_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Margin type *</FormLabel>
                    <Select value={field.value} onValueChange={(value) => field.onChange(value as PartMarginType)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                        <SelectItem value="percent">Percent of cost</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="margin_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{marginType === "percent" ? "Margin %" : "Margin amount"}</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>List price</FormLabel>
                <FormControl>
                  <Input value={calculatedListPrice.toFixed(2)} readOnly className="bg-muted/40" />
                </FormControl>
              </FormItem>
            </div>

            <FormField
              control={form.control}
              name="service_cost_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked labour charge</FormLabel>
                  <FormControl>
                    <ServiceCostCombobox
                      value={field.value}
                      onChange={field.onChange}
                      serviceCosts={serviceCosts}
                    />
                  </FormControl>
                  <FormMessage />
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
                    <FormLabel className="cursor-pointer">HST taxable</FormLabel>
                    <FormDescription className="text-xs">
                      Uncheck for HST-exempt parts. Applies to the list price on every job that uses this part.
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
