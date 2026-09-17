"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { createOilGroup, setOilGroupMembers, updateOilGroup } from "@/lib/actions/pricing";
import type { OilGroup, OilGroupPricingMode, OilType } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";

type FormValues = {
  name: string;
  pricing_mode: OilGroupPricingMode;
  bulk_price_per_litre: string;
  gallon_price_per_container: string;
  sort_order: string;
  active: boolean;
};

const blank: FormValues = {
  name: "",
  pricing_mode: "manual",
  bulk_price_per_litre: "",
  gallon_price_per_container: "",
  sort_order: "100",
  active: true,
};

/**
 * The most expensive of the ticked, active oils — the same rule the database
 * applies in highest_cost mode (private.oil_group_highest_costs, mig 0145), so
 * the dialog can show the price before saving. Gallons are compared per litre
 * because jug sizes differ; oils with no cost entered are skipped.
 */
function highestCosts(members: OilType[]) {
  let bulk: OilType | null = null;
  let gallon: OilType | null = null;
  const gallonPerLitre = (o: OilType) =>
    Number(o.gallon_cost_per_litre) / Number(o.litres_per_gallon);
  for (const o of members) {
    if (!o.active) continue;
    if (Number(o.bulk_cost_per_litre) > 0 && (!bulk || Number(o.bulk_cost_per_litre) > Number(bulk.bulk_cost_per_litre))) {
      bulk = o;
    }
    if (
      Number(o.gallon_cost_per_litre) > 0 &&
      Number(o.litres_per_gallon) > 0 &&
      (!gallon || gallonPerLitre(o) > gallonPerLitre(gallon))
    ) {
      gallon = o;
    }
  }
  return {
    bulk,
    bulkRate: bulk ? Number(bulk.bulk_cost_per_litre) : null,
    gallon,
    gallonPerLitre: gallon ? gallonPerLitre(gallon) : null,
  };
}

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
  oilTypes = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  group?: OilGroup;
  /** Every grade, so the group can pick its members here rather than sending
   *  the owner to the Oil types page to edit them one at a time. */
  oilTypes?: OilType[];
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({ defaultValues: blank });
  // Membership lives on oil_types, not on the group, so it is its own state
  // and its own write — see setOilGroupMembers.
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [oilQuery, setOilQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    form.reset(
      mode === "edit" && group
        ? {
            name: group.name,
            pricing_mode: group.pricing_mode ?? "manual",
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
    setOilQuery("");
    setMemberIds(
      mode === "edit" && group
        ? oilTypes.filter((o) => o.oil_group_id === group.id).map((o) => o.id)
        : [],
    );
  }, [open, mode, group, form, oilTypes]);

  const q = oilQuery.trim().toLowerCase();
  const shownOils = q
    ? oilTypes.filter(
        (o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q),
      )
    : oilTypes;

  const toggleMember = (id: string) =>
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** Which OTHER group already prices this grade — ticking it moves it here. */
  const otherGroupId = (o: OilType) =>
    o.oil_group_id && o.oil_group_id !== group?.id ? o.oil_group_id : null;

  const pricingMode = useWatch({ control: form.control, name: "pricing_mode" });
  const auto = pricingMode === "highest_cost";
  const highest = useMemo(
    () => highestCosts(oilTypes.filter((o) => memberIds.includes(o.id))),
    [oilTypes, memberIds],
  );

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      // In highest_cost mode the database sets the prices and the action drops
      // the typed ones (oilGroupWriteRow). Switching back to manual starts
      // from the last derived bulk price and the gallon price as last typed.
      const payload = {
        name: values.name.trim(),
        pricing_mode: values.pricing_mode,
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

      // Membership is a second write because it lives on oil_types. The group
      // itself is already saved by here, so a failure is reported without
      // pretending the whole save failed.
      const memberRes = await setOilGroupMembers({
        group_id: res.data.id,
        oil_type_ids: memberIds,
      });
      if (!memberRes.ok) {
        toast.error(`Group saved, but the grades could not be set: ${memberRes.error}`);
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

            <FormField
              control={form.control}
              name="pricing_mode"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value === "highest_cost"}
                      onCheckedChange={(v) => field.onChange(v === true ? "highest_cost" : "manual")}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer">
                      Price from the most expensive oil in this group
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Bulk and gallon prices follow the highest cost among the ticked, active oils
                      below, and update by themselves when any of those costs change. It&apos;s
                      charged at cost — the profit comes from the volume tier premium, as on the
                      oil-change price list. Leave groups of very different fluids (e.g. Gear &amp;
                      Trans) on manual.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {auto ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Bulk price $/L</div>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 tabular-nums">
                    {highest.bulkRate != null ? formatMoney(highest.bulkRate) : "not set"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {highest.bulk
                      ? `From ${highest.bulk.name}.`
                      : "No ticked oil has a bulk cost — lines fall back to the base grade."}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Gallon price $/L</div>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 tabular-nums">
                    {highest.gallonPerLitre != null
                      ? `${formatMoney(highest.gallonPerLitre)}/L`
                      : "not set"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {highest.gallon
                      ? `From ${highest.gallon.name}. Each oil's jug is charged at this × its own size (a ${Number(highest.gallon.litres_per_gallon)} L jug = ${formatMoney(Math.round(highest.gallonPerLitre! * Number(highest.gallon.litres_per_gallon) * 100) / 100)}).`
                      : "No ticked oil has a gallon cost — lines fall back to the base grade."}
                  </p>
                </div>
              </div>
            ) : (
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
            )}

            {!auto && (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Leave a price <strong>empty</strong> to fall back to the old single base-grade
                rate for that container. Entering <strong>0</strong> is a real $0 price, not a
                fallback.
              </p>
            )}

            {oilTypes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <FormLabel>Which oils does this group price?</FormLabel>
                  <span className="text-xs text-muted-foreground">
                    {memberIds.length} of {oilTypes.length} oils
                  </span>
                </div>
                <Input
                  value={oilQuery}
                  onChange={(e) => setOilQuery(e.target.value)}
                  placeholder="Search oils by name or code…"
                  className="h-8"
                />
                <div className="max-h-56 overflow-auto rounded-md border divide-y">
                  {shownOils.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No oil matches &ldquo;{oilQuery}&rdquo;.
                    </p>
                  ) : (
                    shownOils.map((o) => {
                      const moving = otherGroupId(o) != null && memberIds.includes(o.id);
                      return (
                        <label
                          key={o.id}
                          className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={memberIds.includes(o.id)}
                            onCheckedChange={() => toggleMember(o.id)}
                          />
                          <span className="min-w-0 flex-1">
                            {/* The oil's own name — these are the grades that
                                make up the group, and a short grade label like
                                "15W40" is also a group name, so it would read
                                as though the list were groups. */}
                            <span className="block truncate">
                              {o.name}
                              {!o.active && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  (inactive)
                                </span>
                              )}
                            </span>
                            <span className="block text-[11px] text-muted-foreground tabular-nums">
                              {o.code}
                              {" · costs "}
                              {formatMoney(o.bulk_cost_per_litre)}/L
                              {Number(o.gallon_cost_per_litre) > 0 &&
                                ` · ${formatMoney(o.gallon_cost_per_litre)}/gal`}
                            </span>
                          </span>
                          {moving && (
                            <span className="mt-0.5 shrink-0 text-[10px] text-amber-600 dark:text-amber-500">
                              moves from another group
                            </span>
                          )}
                          {auto && memberIds.includes(o.id) && (
                            highest.bulk?.id === o.id || highest.gallon?.id === o.id
                          ) && (
                            <span className="mt-0.5 shrink-0 text-[10px] font-medium text-primary">
                              {highest.bulk?.id === o.id && highest.gallon?.id === o.id
                                ? "sets both prices"
                                : highest.bulk?.id === o.id
                                  ? "sets bulk price"
                                  : "sets gallon price"}
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  These are oil grades, not groups. Whichever you tick are charged at this
                  group&apos;s rate instead of their own cost. Unticking one returns it to the
                  single base-grade rate, and an oil can only be in one group.
                </p>
              </div>
            )}

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
