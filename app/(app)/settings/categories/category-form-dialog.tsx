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
  createExpenseCategory,
  updateExpenseCategory,
} from "@/lib/actions/categories";
import type { ExpenseCategory } from "@/lib/db/types";

type FormValues = { name: string; sort_order: string };

export function CategoryFormDialog({
  open,
  onOpenChange,
  mode,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  category?: ExpenseCategory;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    defaultValues: { name: "", sort_order: "0" },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        mode === "edit" && category
          ? { name: category.name, sort_order: String(category.sort_order) }
          : { name: "", sort_order: "0" }
      );
    }
  }, [open, mode, category, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = { name: values.name, sort_order: Number(values.sort_order) };
      const res =
        mode === "create"
          ? await createExpenseCategory(payload)
          : await updateExpenseCategory({ ...payload, id: category!.id });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(mode === "create" ? "Category created" : "Category updated");
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New category" : "Edit category"}
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
                    <Input placeholder="Utilities" {...field} />
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
