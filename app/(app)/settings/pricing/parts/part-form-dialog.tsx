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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createPart, updatePart } from "@/lib/actions/pricing";
import type { AdminPartRow } from "@/lib/actions/pricing";
import type { ServiceCost } from "@/lib/db/types";
import { CreatableCombobox } from "@/components/pricing/creatable-combobox";
import { ServiceCostCombobox } from "@/components/pricing/service-cost-combobox";

type FormValues = {
  part_number: string;
  brand: string;
  category: string;
  description: string;
  cost: string;
  list_price: string;
  mhsw_fee: string;
  service_cost_id: string | null;
  active: boolean;
};

const blank: FormValues = {
  part_number: "",
  brand: "",
  category: "",
  description: "",
  cost: "0",
  list_price: "0",
  mhsw_fee: "0",
  service_cost_id: null,
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
  categories: string[];
  brands: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: blank });

  useEffect(() => {
    if (!open) return;
    form.reset(
      mode === "edit" && part
        ? {
            part_number: part.part_number,
            brand: part.brand,
            category: part.category,
            description: part.description ?? "",
            cost: String(part.cost),
            list_price: String(part.list_price),
            mhsw_fee: String(part.mhsw_fee),
            service_cost_id: part.service_cost_id,
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
        category: values.category.trim(),
        description: values.description.trim() === "" ? null : values.description.trim(),
        cost: Number(values.cost),
        list_price: Number(values.list_price),
        mhsw_fee: Number(values.mhsw_fee),
        service_cost_id: values.service_cost_id || null,
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
            <div className="grid grid-cols-2 gap-3">
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <FormControl>
                    <CreatableCombobox
                      value={field.value}
                      onChange={field.onChange}
                      suggestions={categories}
                      placeholder="Pick category or add new"
                      searchPlaceholder="Search categories or type a new one…"
                      emptyLabel="No categories yet."
                      addLabel="Add category"
                    />
                  </FormControl>
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

            <div className="grid grid-cols-3 gap-3">
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
                name="list_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>List price *</FormLabel>
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
