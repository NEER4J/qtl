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
import { createOilGroup, updateOilGroup } from "@/lib/actions/pricing";
import type { OilGroup } from "@/lib/db/types";

type FormValues = {
  name: string;
  bulk_price_per_litre: string;
  gallon_price_per_container: string;
  sort_order: string;
  active: boolean;
};

const blank: FormValues = {
  name: "",
  bulk_price_per_litre: "",
  gallon_price_per_container: "",
  sort_order: "100",
  active: true,
};

/** "" -> null so a cleared rate means "not set, fall back", not a $0 price. */
const rateOrNull = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export function OilGroupFormDialog({
  open,
  onOpenChange,
  mode,
  group,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  group?: OilGroup;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: blank });

  useEffect(() => {
    if (!open) return;
    form.reset(
      mode === "edit" && group
        ? {
            name: group.name,
            bulk_price_per_litre:
              group.bulk_price_per_litre == null ? "" : String(group.bulk_price_per_litre),
            gallon_price_per_container:
              group.gallon_price_per_container == null
                ? ""
                : String(group.gallon_price_per_container),
            sort_order: String(group.sort_order),
            active: group.active,
          }
        : blank,
    );
  }, [open, mode, group, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = {
        name: values.name.trim(),
        bulk_price_per_litre: rateOrNull(values.bulk_price_per_litre),
        gallon_price_per_container: rateOrNull(values.gallon_price_per_container),
        sort_order: Number(values.sort_order) || 100,
        active: values.active,
      };
      const res =
        mode === "create"
          ? await createOilGroup(payload)
          : await updateOilGroup({ ...payload, id: group!.id });
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof FormValues, { message: v.join(", ") });
          }
        }
        return;
      }
      toast.success(mode === "create" ? "Oil group created" : "Oil group updated");
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New oil group" : "Edit oil group"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 15W40" {...field} />
                  </FormControl>
                  <FormDescription>
                    What the grades in this group have in common — usually the viscosity.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bulk_price_per_litre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bulk price $/L</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="not set"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Charged per litre.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gallon_price_per_container"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gallon price $/container</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="not set"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Whole container, not per litre.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Leave a price <strong>empty</strong> to fall back to the old single base-grade
              rate for that container. Entering <strong>0</strong> is a real $0 price, not a
              fallback.
            </p>

            <FormField
              control={form.control}
              name="sort_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sort order</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" min="0" {...field} />
                  </FormControl>
                  <FormDescription>Lower sorts first in lists.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Deactivating stops the group pricing lines; its oils fall back to the base
                      grade.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

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
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
