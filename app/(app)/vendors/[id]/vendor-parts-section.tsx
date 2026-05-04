"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createVendorPart,
  deactivateVendorPart,
  updateVendorPart,
} from "@/lib/actions/vendor-parts";
import type { Part, VendorPartRow } from "@/lib/db/types";
import { formatMoney } from "@/lib/utils/format";
import { useForm } from "react-hook-form";

export function VendorPartsSection({
  vendorId,
  initialRows,
  parts,
}: {
  vendorId: string;
  initialRows: VendorPartRow[];
  /** All active parts, used by the picker. */
  parts: Pick<Part, "id" | "brand" | "part_number" | "description">[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [editing, setEditing] = useState<VendorPartRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => setRows(initialRows), [initialRows]);

  const handleDeactivate = (r: VendorPartRow) => {
    if (!confirm(`Remove ${r.part?.part_number ?? "this part"} from this vendor?`)) return;
    setPendingId(r.id);
    startTransition(async () => {
      const res = await deactivateVendorPart({ id: r.id });
      setPendingId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Part removed from vendor");
    });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          {rows.length} part{rows.length === 1 ? "" : "s"} supplied
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Add part
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border p-6 text-sm text-center text-muted-foreground">
          No parts linked to this vendor yet.
        </div>
      ) : (
        <div className="rounded-md border max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Vendor part #</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="w-24">Preferred</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    {r.part ? (
                      <>
                        <span className="font-mono">{r.part.part_number}</span>{" "}
                        <span className="text-muted-foreground">{r.part.brand}</span>
                        {r.part.description && (
                          <p className="text-xs text-muted-foreground">{r.part.description}</p>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">(part deleted)</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{r.vendor_part_number ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.cost)}</TableCell>
                  <TableCell>
                    {r.is_preferred && <Badge variant="default">Preferred</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(r)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pendingId === r.id}
                      onClick={() => handleDeactivate(r)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <VendorPartFormDialog
        open={creating}
        onOpenChange={setCreating}
        vendorId={vendorId}
        parts={parts}
        onSaved={(row) => setRows((prev) => [row, ...prev])}
      />
      <VendorPartFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        vendorId={vendorId}
        parts={parts}
        editing={editing ?? undefined}
        onSaved={(row) =>
          setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)))
        }
      />
    </>
  );
}

type DialogFormValues = {
  part_id: string;
  vendor_part_number: string;
  cost: string;
  is_preferred: boolean;
  notes: string;
};

function VendorPartFormDialog({
  open,
  onOpenChange,
  vendorId,
  parts,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  parts: Pick<Part, "id" | "brand" | "part_number" | "description">[];
  editing?: VendorPartRow;
  onSaved: (row: VendorPartRow) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<DialogFormValues>({
    defaultValues: {
      part_id: "",
      vendor_part_number: "",
      cost: "0",
      is_preferred: false,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        part_id: editing.part_id,
        vendor_part_number: editing.vendor_part_number ?? "",
        cost: String(editing.cost),
        is_preferred: editing.is_preferred,
        notes: editing.notes ?? "",
      });
    } else {
      form.reset({
        part_id: "",
        vendor_part_number: "",
        cost: "0",
        is_preferred: false,
        notes: "",
      });
    }
  }, [open, editing, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (!values.part_id) {
      form.setError("part_id", { message: "Pick a part" });
      return;
    }
    startTransition(async () => {
      const payload = {
        vendor_id: vendorId,
        part_id: values.part_id,
        vendor_part_number: values.vendor_part_number || null,
        cost: Number(values.cost),
        is_preferred: values.is_preferred,
        notes: values.notes || null,
      };
      const res = editing
        ? await updateVendorPart({ ...payload, id: editing.id })
        : await createVendorPart(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const part = parts.find((p) => p.id === values.part_id) ?? null;
      const row: VendorPartRow = {
        ...res.data,
        part: part
          ? {
              id: part.id,
              brand: part.brand,
              part_number: part.part_number,
              description: part.description,
              cost: 0,
              list_price: 0,
            }
          : null,
        vendor: null,
      };
      onSaved(row);
      toast.success(editing ? "Vendor part updated" : "Part linked to vendor");
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit vendor part" : "Add part to vendor"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="part_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Part *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!editing}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a part" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {parts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.part_number} — {p.brand}
                          {p.description ? ` (${p.description})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="vendor_part_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor part #</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost *</FormLabel>
                    <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_preferred"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer">Preferred supplier for this part</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
