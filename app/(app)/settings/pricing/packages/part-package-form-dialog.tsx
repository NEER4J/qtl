"use client";

import { useEffect, useState, useTransition } from "react";
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
import { createPartPackage, updatePartPackage } from "@/lib/actions/pricing";
import type { PartPackageWithItems } from "@/lib/db/types";

import { PackageItemsEditor, type PackageItemDraft } from "./package-items-editor";

type FormValues = {
  name: string;
  description: string;
  active: boolean;
  labor_selling_price: string;
  labor_description: string;
};
const blank: FormValues = {
  name: "",
  description: "",
  active: true,
  labor_selling_price: "0",
  labor_description: "",
};

export function PartPackageFormDialog({
  open,
  onOpenChange,
  mode,
  pkg,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  pkg?: PartPackageWithItems;
}) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<PackageItemDraft[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const form = useForm<FormValues>({ defaultValues: blank });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && pkg) {
      form.reset({
        name: pkg.name,
        description: pkg.description ?? "",
        active: pkg.active,
        labor_selling_price: String(pkg.labor_selling_price ?? 0),
        labor_description: pkg.labor_description ?? "",
      });
      setItems(
        pkg.items
          // Skip oil-typed package items in this editor — they are managed
          // through the oil grid linkage and surface only at expansion time.
          .filter((it) => it.part != null && it.part_id != null)
          .map((it) => ({
            part_id: it.part_id as string,
            quantity: Number(it.quantity),
            unit_price: it.unit_price == null ? "" : String(Number(it.unit_price)),
            part: {
              brand: it.part!.brand,
              part_number: it.part!.part_number,
              description: it.part!.description,
              list_price: Number(it.part!.list_price),
              unit_of_measure: it.part!.unit_of_measure,
            },
          })),
      );
    } else {
      form.reset(blank);
      setItems([]);
    }
    setItemsError(null);
  }, [open, mode, pkg, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (items.length === 0) {
      setItemsError("Add at least one part.");
      return;
    }
    setItemsError(null);

    const payload = {
      name: values.name.trim(),
      description: values.description.trim() ? values.description.trim() : null,
      active: values.active,
      labor_selling_price: Number(values.labor_selling_price) || 0,
      labor_description:
        values.labor_description.trim() === "" ? null : values.labor_description.trim(),
      items: items.map((it) => {
        const trimmed = it.unit_price.trim();
        return {
          part_id: it.part_id,
          quantity: it.quantity,
          unit_price: trimmed === "" ? null : Number(trimmed),
        };
      }),
    };

    startTransition(async () => {
      const res =
        mode === "create"
          ? await createPartPackage(payload)
          : await updatePartPackage({ ...payload, id: pkg!.id });
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            if (
              k === "name" ||
              k === "description" ||
              k === "active" ||
              k === "labor_selling_price" ||
              k === "labor_description"
            ) {
              form.setError(k as keyof FormValues, { message: v.join(", ") });
            } else if (k.startsWith("items")) {
              setItemsError(v.join(", "));
            }
          }
        }
        return;
      }
      toast.success(mode === "create" ? "Package created" : "Package updated");
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New package" : "Edit package"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Standard Oil Change" {...field} />
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
                    <Textarea
                      placeholder="Optional notes about what this package is for."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <p className="text-sm font-medium">Labor</p>
              <p className="text-xs text-muted-foreground">
                Added on top of the parts in this package. Becomes its own line
                item when the package is dropped onto a job.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="labor_selling_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Labor charge</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="labor_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder='e.g. "Service labor — oil change"' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">Parts in this package</p>
                <p className="text-xs text-muted-foreground">
                  Unit price comes from the catalogue when added to a job.
                </p>
              </div>
              <PackageItemsEditor items={items} onChange={setItems} />
              {itemsError && (
                <p className="text-sm text-destructive">{itemsError}</p>
              )}
            </div>

            {mode === "edit" && (
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Active</FormLabel>
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
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
