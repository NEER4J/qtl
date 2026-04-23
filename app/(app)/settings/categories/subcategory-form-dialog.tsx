"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  createExpenseSubcategory,
  updateExpenseSubcategory,
} from "@/lib/actions/categories";
import type { ExpenseSubcategory } from "@/lib/db/types";

type FormValues = { name: string; sort_order: string };

export function SubcategoryFormDialog({
  open,
  onOpenChange,
  mode,
  categoryId,
  subcategory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  categoryId: string;
  subcategory?: ExpenseSubcategory;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    defaultValues: { name: "", sort_order: "0" },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        mode === "edit" && subcategory
          ? { name: subcategory.name, sort_order: String(subcategory.sort_order) }
          : { name: "", sort_order: "0" }
      );
    }
  }, [open, mode, subcategory, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = {
        category_id: categoryId,
        name: values.name,
        sort_order: Number(values.sort_order),
      };
      const res =
        mode === "create"
          ? await createExpenseSubcategory(payload)
          : await updateExpenseSubcategory({ ...payload, id: subcategory!.id });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(mode === "create" ? "Subcategory created" : "Subcategory updated");
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New subcategory" : "Edit subcategory"}
          </DialogTitle>
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
                    <Input placeholder="Electricity" {...field} />
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
