"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createVendorInvoice,
  recordVendorInvoicePayment,
} from "@/lib/actions/vendor-invoices";
import { listActiveLocations } from "@/lib/actions/reference";
import type { Location, VendorInvoice } from "@/lib/db/types";
import { formatDate, formatMoney, todayISO } from "@/lib/utils/format";

const STATUS_COLORS: Record<string, string> = {
  paid: "text-emerald-600",
  partial: "text-amber-600",
  outstanding: "text-rose-600",
};

export function VendorInvoicesSection({
  vendorId,
  invoices: initialInvoices,
}: {
  vendorId: string;
  invoices: VendorInvoice[];
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<VendorInvoice | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => setInvoices(initialInvoices), [initialInvoices]);

  useEffect(() => {
    listActiveLocations().then(setLocations).catch(() => setLocations([]));
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-md border p-6 text-sm text-center text-muted-foreground">
          No vendor invoices yet.
        </div>
      ) : (
        <div className="rounded-md border max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                  <TableCell className="font-mono text-sm">{inv.invoice_no ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[inv.payment_status] ?? ""}>
                      {inv.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(inv.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {inv.balance > 0 ? (
                      <span className="text-rose-600 font-medium">{formatMoney(inv.balance)}</span>
                    ) : (
                      formatMoney(0)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {inv.balance > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setPaying(inv)}>
                        Record payment
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateVendorInvoiceDialog
        open={creating}
        onOpenChange={setCreating}
        vendorId={vendorId}
        locations={locations}
        onCreated={(inv) => setInvoices((prev) => [inv, ...prev])}
      />
      <RecordPaymentDialog
        invoice={paying}
        onClose={() => setPaying(null)}
        onPaid={(inv) =>
          setInvoices((prev) => prev.map((x) => (x.id === inv.id ? inv : x)))
        }
      />
    </>
  );
}

type CreateValues = {
  invoice_no: string;
  invoice_date: string;
  location_id: string;
  sub_total: string;
  hst: string;
  paid_amount: string;
  notes: string;
};

function CreateVendorInvoiceDialog({
  open,
  onOpenChange,
  vendorId,
  locations,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  locations: Location[];
  onCreated: (inv: VendorInvoice) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<CreateValues>({
    defaultValues: {
      invoice_no: "",
      invoice_date: todayISO(),
      location_id: "",
      sub_total: "0",
      hst: "0",
      paid_amount: "0",
      notes: "",
    },
  });

  useEffect(() => {
    if (open && locations.length > 0 && !form.getValues("location_id")) {
      form.setValue("location_id", locations[0].id);
    }
  }, [open, locations, form]);

  const onSubmit = form.handleSubmit((values) => {
    if (!values.location_id) {
      form.setError("location_id", { message: "Pick a location" });
      return;
    }
    startTransition(async () => {
      const res = await createVendorInvoice({
        vendor_id: vendorId,
        location_id: values.location_id,
        invoice_no: values.invoice_no || null,
        invoice_date: values.invoice_date,
        sub_total: Number(values.sub_total),
        hst: Number(values.hst),
        paid_amount: Number(values.paid_amount),
        notes: values.notes || null,
        items: [],
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onCreated(res.data);
      toast.success("Vendor invoice created");
      onOpenChange(false);
      form.reset();
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New vendor invoice</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="invoice_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice #</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoice_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location *</FormLabel>
                  <FormControl>
                    <select
                      className="w-full h-9 px-3 border rounded-md bg-background text-sm"
                      {...field}
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="sub_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-total *</FormLabel>
                    <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hst"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HST</FormLabel>
                    <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paid_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid</FormLabel>
                    <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
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
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({
  invoice,
  onClose,
  onPaid,
}: {
  invoice: VendorInvoice | null;
  onClose: () => void;
  onPaid: (inv: VendorInvoice) => void;
}) {
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (invoice) setAmount(String(invoice.balance));
  }, [invoice]);

  if (!invoice) return null;

  const submit = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Amount must be > 0");
      return;
    }
    startTransition(async () => {
      const res = await recordVendorInvoicePayment({ id: invoice.id, amount: n });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onPaid(res.data);
      toast.success("Payment recorded");
      onClose();
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Balance owing <span className="font-medium text-foreground">{formatMoney(invoice.balance)}</span>
          </div>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={submit}>
            {isPending ? "Saving…" : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
