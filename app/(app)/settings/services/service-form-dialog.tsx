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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createServiceType, updateServiceType } from "@/lib/actions/services";
import type { ServiceType } from "@/lib/db/types";

type FormValues = { code: string; name: string; sort_order: string };

export function ServiceFormDialog({
  open,
  onOpenChange,
  mode,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  service?: ServiceType;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    defaultValues: { code: "", name: "", sort_order: "0" },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        mode === "edit" && service
          ? { code: service.code, name: service.name, sort_order: String(service.sort_order) }
          : { code: "", name: "", sort_order: "0" }
      );
    }
  }, [open, mode, service, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = {
        code: values.code.toUpperCase(),
        name: values.name,
        sort_order: Number(values.sort_order),
      };
      const res =
        mode === "create"
          ? await createServiceType(payload)
          : await updateServiceType({ ...payload, id: service!.id });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(mode === "create" ? "Service type created" : "Service type updated");
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New service type" : "Edit service type"}
          </DialogTitle>
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
                      placeholder="OC"
                      maxLength={10}
                      className="uppercase"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>Short uppercase code (e.g. OC, PG, FG).</FormDescription>
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
                    <Input placeholder="Oil Change" {...field} />
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
