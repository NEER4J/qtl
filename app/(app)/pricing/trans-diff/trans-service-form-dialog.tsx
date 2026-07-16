"use client";

import { useEffect, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
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

// Radix Select can't hold an empty-string value, so "none" uses a sentinel.
const NO_OIL = "__none__";
const NO_CONTAINER = "__none__";

const KINDS = [
  "allison_trans",
  "trans",
  "diff",
  "combined",
  "specialty_trans",
  "coolant_flush",
] as const;

const CONTAINERS = ["bulk", "gallon", "pail"] as const;

type FormValues = {
  name: string;
  service_kind: (typeof KINDS)[number];
  is_synthetic: boolean;
  container: string;
  // Oil 1
  oil_type_id: string;
  litres: string;
  sell_price: string;
  // Oil 2 (optional)
  oil_type_id_2: string;
  litres_2: string;
  sell_price_2: string;
  labour: string;
  notes: string;
  sort_order: string;
  active: boolean;
};

const blank: FormValues = {
  name: "",
  service_kind: "trans",
  is_synthetic: false,
  container: NO_CONTAINER,
  oil_type_id: NO_OIL,
  litres: "",
  sell_price: "0",
  oil_type_id_2: NO_OIL,
  litres_2: "",
  sell_price_2: "",
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

  const serviceKind = useWatch({ control: form.control, name: "service_kind" });
  // Coolant flush is measured in gallons, everything else in litres. Display only
  // — the value is still stored in the litres columns. (client 2026-06-30.)
  const qtyUnit = serviceKind === "coolant_flush" ? "Gallons" : "Litres";

  useEffect(() => {
    if (!open) return;
    form.reset(
      mode === "edit" && service
        ? {
            name: service.name,
            service_kind: service.service_kind,
            is_synthetic: service.is_synthetic,
            container: service.container ?? NO_CONTAINER,
            oil_type_id: service.oil_type_id ?? NO_OIL,
            litres: service.litres == null ? "" : String(service.litres),
            sell_price: String(service.sell_price),
            oil_type_id_2: service.oil_type_id_2 ?? NO_OIL,
            litres_2: service.litres_2 == null ? "" : String(service.litres_2),
            sell_price_2: service.sell_price_2 == null ? "" : String(service.sell_price_2),
            labour: service.labour == null ? "" : String(service.labour),
            notes: service.notes ?? "",
            sort_order: String(service.sort_order),
            active: service.active,
          }
        : blank,
    );
  }, [open, mode, service, form]);

  // ── Auto-fill the sell price from the oil's cost-rate × capacity ──────────
  // Fired from the oil / litres / container controls' own onChange (NOT an
  // effect) so it never clobbers a saved or hand-typed price on open. Bulk &
  // pail use the bulk rate; gallon uses the gallon rate. Editable afterwards.
  const suggestPrice = (oilId: string, litresStr: string, container: string): number | null => {
    if (oilId === NO_OIL || oilId === "") return null;
    const oil = oilTypes.find((o) => o.id === oilId);
    const litres = Number(litresStr);
    if (!oil || !Number.isFinite(litres) || litres <= 0) return null;
    const rate =
      container === "gallon"
        ? Number(oil.gallon_cost_per_litre)
        : Number(oil.bulk_cost_per_litre);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return Math.round(rate * litres * 100) / 100;
  };
  const recalc = (which: 1 | 2, oilId: string, litresStr: string, container: string) => {
    const s = suggestPrice(oilId, litresStr, container);
    if (s == null) return;
    form.setValue(which === 1 ? "sell_price" : "sell_price_2", String(s), {
      shouldValidate: which === 1,
    });
  };

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = {
        name: values.name.trim(),
        service_kind: values.service_kind,
        is_synthetic: values.is_synthetic,
        container: values.container === NO_CONTAINER ? null : values.container,
        oil_type_id: values.oil_type_id === NO_OIL ? null : values.oil_type_id,
        litres: values.litres.trim() === "" ? null : Number(values.litres),
        sell_price: Number(values.sell_price),
        oil_type_id_2: values.oil_type_id_2 === NO_OIL ? null : values.oil_type_id_2,
        litres_2: values.litres_2.trim() === "" ? null : Number(values.litres_2),
        sell_price_2: values.sell_price_2.trim() === "" ? null : Number(values.sell_price_2),
        // Both oils are always charged (oil1 + oil2 + labour) — default_oil no
        // longer affects pricing, so it's always sent as 1.
        default_oil: 1,
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
                name="container"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Container</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        const cur = form.getValues();
                        const cont = v === NO_CONTAINER ? "" : v;
                        recalc(1, cur.oil_type_id, cur.litres, cont);
                        recalc(2, cur.oil_type_id_2, cur.litres_2, cont);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_CONTAINER}>—</SelectItem>
                        {CONTAINERS.map((c) => (
                          <SelectItem key={c} value={c} className="capitalize">
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Oil 1 ─────────────────────────────────────────────── */}
            <div className="rounded-md border p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Oil 1</p>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="oil_type_id"
                  render={({ field }) => (
                    <FormItem className="col-span-3">
                      <FormLabel>Oil / fluid</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          const cur = form.getValues();
                          recalc(1, v, cur.litres, cur.container === NO_CONTAINER ? "" : cur.container);
                        }}
                      >
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
                <FormField
                  control={form.control}
                  name="litres"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{qtyUnit}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="—"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            const cur = form.getValues();
                            recalc(1, cur.oil_type_id, e.target.value, cur.container === NO_CONTAINER ? "" : cur.container);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sell_price"
                  rules={{ required: "Required" }}
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Sell price *</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Auto-filled from oil × {qtyUnit.toLowerCase()}; editable.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ── Oil 2 (optional) ──────────────────────────────────── */}
            <div className="rounded-md border p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Oil 2{" "}
                <span className="font-normal">
                  (optional — for services that use two fluids. When set, BOTH oils&apos;
                  sell prices are charged together, plus labour.)
                </span>
              </p>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="oil_type_id_2"
                  render={({ field }) => (
                    <FormItem className="col-span-3">
                      <FormLabel>Oil / fluid</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          const cur = form.getValues();
                          recalc(2, v, cur.litres_2, cur.container === NO_CONTAINER ? "" : cur.container);
                        }}
                      >
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
                <FormField
                  control={form.control}
                  name="litres_2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{qtyUnit}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="—"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            const cur = form.getValues();
                            recalc(2, cur.oil_type_id_2, e.target.value, cur.container === NO_CONTAINER ? "" : cur.container);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sell_price_2"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Sell price</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" placeholder="—" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="labour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Labour</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" placeholder="—" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Added on top of the sell price.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_synthetic"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-2 space-y-0 pt-6">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                    </FormControl>
                    <div className="leading-none">
                      <FormLabel className="cursor-pointer">Synthetic</FormLabel>
                      <FormDescription className="text-xs">
                        Tags the row Reg / Syn. Off for regular oil / coolant.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

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
