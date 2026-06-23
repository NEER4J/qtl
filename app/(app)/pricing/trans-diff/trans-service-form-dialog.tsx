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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTransmissionService,
  updateTransmissionService,
} from "@/lib/actions/pricing";
import type { TransmissionService } from "@/lib/actions/pricing";
import type { OilType } from "@/lib/db/types";
import { TRANSMISSION_KIND_LABEL } from "@/lib/utils/transmission";

// Radix Select can't hold an empty-string value, so "no oil" uses a sentinel.
const NO_OIL = "__none__";

const KINDS = [
  "allison_trans",
  "trans",
  "diff",
  "combined",
  "specialty_trans",
  "coolant_flush",
] as const;

type FormValues = {
  name: string;
  service_kind: (typeof KINDS)[number];
  is_synthetic: boolean;
  oil_type_id: string;
  litres: string;
  sell_price: string;
  labour: string;
  notes: string;
  sort_order: string;
  active: boolean;
};

const blank: FormValues = {
  name: "",
  service_kind: "trans",
  is_synthetic: false,
  oil_type_id: NO_OIL,
  litres: "",
  sell_price: "0",
  labour: "",
  notes: "",
  sort_order: "100",
  active: true,
};

export function TransServiceFormDialog({
  open,
  onOpenChange,
  mode,
  service,
  oilTypes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  service?: TransmissionService;
  oilTypes: OilType[];
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: blank });

  useEffect(() => {
    if (!open) return;
    form.reset(
      mode === "edit" && service
        ? {
            name: service.name,
            service_kind: service.service_kind,
            is_synthetic: service.is_synthetic,
            oil_type_id: service.oil_type_id ?? NO_OIL,
            litres: service.litres == null ? "" : String(service.litres),
            sell_price: String(service.sell_price),
            labour: service.labour == null ? "" : String(service.labour),
            notes: service.notes ?? "",
            sort_order: String(service.sort_order),
            active: service.active,
          }
        : blank,
    );
  }, [open, mode, service, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = {
        name: values.name.trim(),
        service_kind: values.service_kind,
        is_synthetic: values.is_synthetic,
        oil_type_id: values.oil_type_id === NO_OIL ? null : values.oil_type_id,
        litres: values.litres.trim() === "" ? null : Number(values.litres),
        sell_price: Number(values.sell_price),
        labour: values.labour.trim() === "" ? null : Number(values.labour),
        notes: values.notes.trim() === "" ? null : values.notes.trim(),
        sort_order: Number(values.sort_order) || 0,
        active: values.active,
      };
      const res =
        mode === "create"
          ? await createTransmissionService(payload)
          : await updateTransmissionService({ ...payload, id: service!.id });
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            form.setError(k as keyof FormValues, { message: v.join(", ") });
          }
        }
        return;
      }
      toast.success(mode === "create" ? "Service created" : "Service updated");
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New Trans & Diff service" : "Edit Trans & Diff service"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Allison 2500 Trans Service" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="service_kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {TRANSMISSION_KIND_LABEL[k] ?? k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="oil_type_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Oil / fluid</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_OIL}>None</SelectItem>
                        {oilTypes.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.code} — {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="sell_price"
                rules={{ required: "Required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sell price *</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="labour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Labour</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" placeholder="—" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="litres"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Litres</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.1" placeholder="—" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_synthetic"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <div className="leading-none">
                    <FormLabel className="cursor-pointer">Synthetic</FormLabel>
                    <FormDescription className="text-xs">
                      Tags the row Reg / Syn. Leave off for regular oil and coolant flushes.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
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
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
