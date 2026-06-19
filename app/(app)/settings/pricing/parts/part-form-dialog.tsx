"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { CreatableCombobox } from "@/components/pricing/creatable-combobox";
import { ServiceCostCombobox } from "@/components/pricing/service-cost-combobox";
import { InfoTip } from "@/components/help/info-tip";
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
import {
  checkPartNumberExists,
  createPart,
  updatePart,
} from "@/lib/actions/pricing";
import type { AdminPartRow, PartCategoryOption } from "@/lib/actions/pricing";
import type { PartMarginType, ServiceCost } from "@/lib/db/types";
import { calculatePartListPrice } from "@/lib/utils/part-pricing";
import { formatMoney } from "@/lib/utils/format";

type FormValues = {
  part_number: string;
  brand: string;
  category_id: string;
  description: string;
  cost: string;
  mhsw_fee: string;
  mhsw_buy: string;
  counter_premium: string;
  customer_supplies_labour: string;
  margin_type: PartMarginType;
  margin_value: string;
  service_cost_id: string | null;
  is_taxable: boolean;
  in_package: boolean;
  active: boolean;
  extra_price: string;
};

const blank: FormValues = {
  part_number: "",
  brand: "",
  category_id: "",
  description: "",
  cost: "0",
  mhsw_fee: "0",
  mhsw_buy: "0",
  counter_premium: "",
  customer_supplies_labour: "",
  margin_type: "fixed",
  margin_value: "0",
  service_cost_id: null,
  is_taxable: true,
  in_package: false,
  active: true,
  extra_price: "0",
};

export function PartFormDialog({
  open,
  onOpenChange,
  mode,
  part,
  serviceCosts,
  categories,
  brands,
  globalCounterPremium,
  globalCustomerSuppliesLabour,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  part?: AdminPartRow;
  serviceCosts: ServiceCost[];
  categories: PartCategoryOption[];
  brands: string[];
  /** Global app_settings defaults — shown as placeholders when the part leaves
   *  its own counter premium / customer-supplies labour blank. */
  globalCounterPremium: number;
  globalCustomerSuppliesLabour: number;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: blank });
  const [
    cost = "0",
    mhswFee = "0",
    mhswBuy = "0",
    marginType = "fixed",
    marginValue = "0",
    categoryId,
    partNumber = "",
  ] = useWatch({
    control: form.control,
    name: ["cost", "mhsw_fee", "mhsw_buy", "margin_type", "margin_value", "category_id", "part_number"],
  });

  const [duplicateMatches, setDuplicateMatches] = useState<
    { id: string; part_number: string; brand: string; active: boolean }[]
  >([]);

  // Cost and Buy MHSW are independent inputs. The "Total cost" below = base Cost
  // + Buy MHSW; that total is what's saved to the DB cost column and drives the
  // margin / list price.
  const baseCostNum = Number(cost) || 0;
  const buyMhswNum = Number(mhswBuy) || 0;
  const totalCost = Math.round((baseCostNum + buyMhswNum) * 100) / 100;

  const calculatedListPrice = calculatePartListPrice({
    cost: totalCost,
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
            // Stored cost includes Buy MHSW; show the BASE in the Cost input so
            // the Total cost below re-derives to the stored value (no double add).
            cost: String(Math.round((Number(part.cost) - Number(part.mhsw_buy ?? 0)) * 100) / 100),
            mhsw_fee: String(part.mhsw_fee),
            mhsw_buy: String(part.mhsw_buy ?? 0),
            counter_premium: part.counter_premium == null ? "" : String(part.counter_premium),
            customer_supplies_labour:
              part.customer_supplies_labour == null ? "" : String(part.customer_supplies_labour),
            margin_type: part.margin_type,
            margin_value: String(part.margin_value),
            service_cost_id: part.service_cost_id,
            is_taxable: part.is_taxable,
            in_package: part.in_package ?? false,
            active: part.active,
            extra_price: String(part.extra_price ?? 0),
          }
        : blank,
    );
    setDuplicateMatches([]);
  }, [open, mode, part, form]);

  // Debounced "this part number already exists" check. Runs as the user types
  // — surfaces a warning before they fill in the rest of the form. Excludes
  // the current part in edit mode so editing its own row doesn't self-flag.
  useEffect(() => {
    if (!open) return;
    const trimmed = partNumber.trim();
    if (trimmed.length < 2) {
      setDuplicateMatches([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await checkPartNumberExists({
          part_number: trimmed,
          excludeId: mode === "edit" && part ? part.id : null,
        });
        if (!cancelled) setDuplicateMatches(res.matches);
      } catch {
        if (!cancelled) setDuplicateMatches([]);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [partNumber, open, mode, part]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const extraTrimmed = values.extra_price.trim();
      const counterTrimmed = values.counter_premium.trim();
      const suppliesTrimmed = values.customer_supplies_labour.trim();
      const payload = {
        part_number: values.part_number.trim(),
        brand: values.brand.trim(),
        category_id: values.category_id,
        description: values.description.trim() === "" ? null : values.description.trim(),
        // Saved cost = Total cost = base Cost + Buy MHSW.
        cost:
          Math.round(((Number(values.cost) || 0) + (Number(values.mhsw_buy) || 0)) * 100) / 100,
        mhsw_fee: Number(values.mhsw_fee),
        mhsw_buy: Number(values.mhsw_buy),
        counter_premium: counterTrimmed === "" ? null : Number(counterTrimmed),
        customer_supplies_labour: suppliesTrimmed === "" ? null : Number(suppliesTrimmed),
        margin_type: values.margin_type,
        margin_value: Number(values.margin_value),
        service_cost_id: values.service_cost_id || null,
        is_taxable: values.is_taxable,
        in_package: values.in_package,
        active: values.active,
        extra_price: extraTrimmed === "" ? 0 : Number(extraTrimmed),
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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New part" : "Edit part"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="part_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Part number *</FormLabel>
                    <FormControl>
                      <Input placeholder="LF9080" {...field} />
                    </FormControl>
                    {duplicateMatches.length > 0 && (
                      <div className="mt-1 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        <div>
                          <div className="font-medium">
                            Already in catalog
                            {duplicateMatches.length > 1 ? ` (${duplicateMatches.length} matches)` : ""}
                          </div>
                          <ul className="mt-0.5 space-y-0.5">
                            {duplicateMatches.slice(0, 3).map((m) => (
                              <li key={m.id}>
                                <span className="font-mono">{m.part_number}</span> — {m.brand}
                                {!m.active && (
                                  <span className="ml-1 text-muted-foreground">(inactive)</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
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
                        Shown in <strong>{selectedCategory.unit_of_measure}</strong>.
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="mhsw_buy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Buy MHSW
                      <InfoTip>Cost-side MHSW you pay. Added to the base Cost in the Total cost below, which is what gets saved.</InfoTip>
                    </FormLabel>
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
                    <FormLabel className="flex items-center gap-1">
                      Sell MHSW
                      <InfoTip>Customer-facing MHSW — added into the cost basis first, then marked up by the margin into the list/sell price.</InfoTip>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Cost *
                      <InfoTip>Base cost you pay. Buy MHSW is added to it in the Total cost below.</InfoTip>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Total cost = base Cost + Buy MHSW. This is the value saved to the
                DB cost column and used for the margin / list price. */}
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-1 text-sm font-medium">
                Total cost
                <InfoTip>Base Cost + Buy MHSW. Saved to the part&apos;s cost and used for the margin and list price.</InfoTip>
              </div>
              <div className="text-right">
                <div className="text-base font-semibold tabular-nums">{formatMoney(totalCost)}</div>
                {buyMhswNum > 0 && (
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {formatMoney(baseCostNum)} + {formatMoney(buyMhswNum)} Buy MHSW
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="counter_premium"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Service charge
                      <InfoTip>
                        Added to Total cost to make the <strong>With Service</strong> price. May be
                        negative. Leave blank to use the global default ({formatMoney(globalCounterPremium)}).
                      </InfoTip>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={`Default ${formatMoney(globalCounterPremium)}`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customer_supplies_labour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Customer-supplies labour
                      <InfoTip>
                        Flat labour fee when the customer brings their own filter. Leave blank to use
                        the global default ({formatMoney(globalCustomerSuppliesLabour)}).
                      </InfoTip>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={`Default ${formatMoney(globalCustomerSuppliesLabour)}`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        <SelectItem value="percent">Percent of (cost + Sell MHSW)</SelectItem>
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
              name="extra_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Extra price (signed delta)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Applied as an upcharge (positive) or credit (negative) to the matching same-category line on a job when this part is added via a package. Default 0 = no adjustment.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="is_taxable"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-2 space-y-0 rounded-md border p-3">
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

              <FormField
                control={form.control}
                name="in_package"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-2 space-y-0 rounded-md border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                    </FormControl>
                    <div className="leading-none">
                      <FormLabel className="cursor-pointer">Bundled in a package</FormLabel>
                      <FormDescription className="text-xs">
                        When on, the All Filter Sell Price shows <strong>With Service = $0</strong> for this part (the customer pays for the package). If the same part is added to a sales job a second time, the extra one auto-uses the <strong>Over the Counter</strong> price.
                      </FormDescription>
                    </div>
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
