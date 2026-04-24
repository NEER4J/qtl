"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createVendor, updateVendor } from "@/lib/actions/vendors";
import { CreateVendorInput } from "@/lib/schemas/vendors";
import type { ExpenseCategory, Vendor } from "@/lib/db/types";

const NO_CATEGORY = "__none__";

type FormValues = {
  code: string;
  name: string;
  contact_no: string;
  email: string;
  account_no: string;
  account_type: string;
  category_id: string;
  notes: string;
};

export function VendorFormDialog({
  open,
  onOpenChange,
  mode,
  vendor,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  vendor?: Vendor;
  categories: ExpenseCategory[];
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    defaultValues: {
      code: "",
      name: "",
      contact_no: "",
      email: "",
      account_no: "",
      account_type: "",
      category_id: NO_CATEGORY,
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (mode === "edit" && vendor) {
        form.reset({
          code: vendor.code ?? "",
          name: vendor.name,
          contact_no: vendor.contact_no ?? "",
          email: vendor.email ?? "",
          account_no: vendor.account_no ?? "",
          account_type: vendor.account_type ?? "",
          category_id: vendor.category_id ?? NO_CATEGORY,
          notes: vendor.notes ?? "",
        });
      } else {
        form.reset({
          code: "",
          name: "",
          contact_no: "",
          email: "",
          account_no: "",
          account_type: "",
          category_id: NO_CATEGORY,
          notes: "",
        });
      }
    }
  }, [open, mode, vendor, form]);

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      code: values.code || null,
      name: values.name,
      contact_no: values.contact_no || null,
      email: values.email || null,
      account_no: values.account_no || null,
      account_type: values.account_type || null,
      category_id:
        values.category_id && values.category_id !== NO_CATEGORY
          ? values.category_id
          : null,
      notes: values.notes || null,
    };

    const parsed = CreateVendorInput.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[issue.path.length - 1]?.toString();
        if (path) form.setError(path as keyof FormValues, { message: issue.message });
      }
      return;
    }

    startTransition(async () => {
      const res =
        mode === "create"
          ? await createVendor(parsed.data)
          : await updateVendor({ ...parsed.data, id: vendor!.id });

      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, msgs] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof FormValues, { message: msgs[0] });
          }
        }
        return;
      }
      toast.success(mode === "create" ? "Vendor created" : "Vendor updated");
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New vendor" : "Edit vendor"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Add a new vendor." : "Update vendor details."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor code</FormLabel>
                  <FormControl>
                    <Input placeholder="Auto-generated if blank" className="font-mono" {...field} />
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
                    <Input placeholder="TD Bank" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Category</FormLabel>
                    <a
                      href="/settings/categories"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Manage categories
                    </a>
                  </div>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(226) 555-0100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="billing@td.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="account_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account #</FormLabel>
                    <FormControl>
                      <Input placeholder="123-456-78" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="account_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account type</FormLabel>
                    <FormControl>
                      <Input placeholder="Chequing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
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
