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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createOilGroup, setOilGroupMembers, updateOilGroup } from "@/lib/actions/pricing";
import type { OilGroup, OilType } from "@/lib/db/types";
import { excelOilLabel } from "@/lib/utils/oil-labels";

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
    setMemberIds(
      mode === "edit" && group
        ? oilTypes.filter((o) => o.oil_group_id === group.id).map((o) => o.id)
        : [],
    );
  }, [open, mode, group, form, oilTypes]);

  const toggleMember = (id: string) =>
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** Which OTHER group already prices this grade — ticking it moves it here. */
  const otherGroupId = (o: OilType) =>
    o.oil_group_id && o.oil_group_id !== group?.id ? o.oil_group_id : null;

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

            {oilTypes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <FormLabel>Grades priced by this group</FormLabel>
                  <span className="text-xs text-muted-foreground">
                    {memberIds.length} selected
                  </span>
                </div>
                <div className="max-h-56 overflow-auto rounded-md border divide-y">
                  {oilTypes.map((o) => {
                    const moving = otherGroupId(o) != null && memberIds.includes(o.id);
                    return (
                      <label
                        key={o.id}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={memberIds.includes(o.id)}
                          onCheckedChange={() => toggleMember(o.id)}
                        />
                        <span className="flex-1 truncate">
                          {excelOilLabel(o.code, o.name)}
                          {!o.active && (
                            <span className="ml-1 text-xs text-muted-foreground">(inactive)</span>
                          )}
                        </span>
                        {moving && (
                          <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-500">
                            moves from another group
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Unticking a grade returns it to the single base-grade rate. A grade can only be
                  in one group, so ticking one that belongs elsewhere moves it here.
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
