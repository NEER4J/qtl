import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CreditCard, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddExpensePaymentDialog } from "@/components/expenses/add-expense-payment-dialog";
import { StatusBadge } from "@/components/sales/status-badge";
import { requireProfile } from "@/lib/auth/require";
import { getExpense } from "@/lib/actions/expenses";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  cheque: "Cheque",
  debit: "Debit",
  visa: "Visa",
  mastercard: "Mastercard",
  etransfer: "E-Transfer",
  credit_card: "Credit Card",
  oc: "Outstanding",
};

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const exp = await getExpense(id);
  if (!exp) notFound();

  const canEdit =
    profile.role === "owner" ||
    profile.role === "accountant" ||
    (profile.role === "manager" && profile.location_id === exp.location_id);

  const canAddPayment =
    profile.role === "owner" ||
    profile.role === "accountant" ||
    (profile.role === "manager" && profile.location_id === exp.location_id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href="/expenses">
              <ChevronLeft className="size-4" /> Back to expenses
            </Link>
          </Button>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {exp.category_name}
              {exp.subcategory_name ? ` · ${exp.subcategory_name}` : ""}
            </h1>
            <StatusBadge status={exp.payment_status} />
            {exp.deactivated_at && <Badge variant="secondary">Deactivated</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(exp.expense_date)} · {exp.location_name}
            {exp.vendor_name ? ` · ${exp.vendor_name}` : ""}
            {exp.invoice_no ? ` · #${exp.invoice_no}` : ""}
          </p>
        </div>
        {canEdit && !exp.deactivated_at && (
          <Button asChild variant="outline">
            <Link href={`/expenses/${exp.id}/edit`}>
              <Pencil className="size-4" /> Edit
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Vendor</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Vendor" value={exp.vendor_name ?? exp.vendor_name_snapshot} />
            <Field label="Invoice #" value={exp.invoice_no} mono />
            <Field label="Account #" value={exp.account_number} mono />
            <Field label="Account type" value={exp.account_type} />
            <Field label="Contact" value={exp.contact_no} />
            <Field label="Email" value={exp.email} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Amounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Sub Total" value={formatMoney(exp.sub_total)} />
            <Row label="HST" value={formatMoney(exp.hst)} />
            <Row label="Total" value={formatMoney(exp.total)} bold />
            <div className="border-t my-2" />
            <Row label="Paid" value={formatMoney(exp.paid_amount)} />
            <Row label="Balance" value={formatMoney(exp.balance)} bold />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Payment date" value={exp.payment_date ? formatDate(exp.payment_date) : null} />
          <Field
            label="Payment mode"
            value={exp.payment_mode ? PAYMENT_MODE_LABELS[exp.payment_mode] : null}
          />
          <Field label="Transaction" value={exp.transaction_id} mono />
          <Field label="Batch" value={exp.batch_id} mono />
        </CardContent>
        {exp.notes && (
          <CardContent className="border-t pt-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Notes</div>
            <p className="text-sm whitespace-pre-wrap">{exp.notes}</p>
          </CardContent>
        )}
      </Card>

      {exp.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-24">Qty</TableHead>
                  <TableHead className="text-right w-32">Unit cost</TableHead>
                  <TableHead className="text-right w-32">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exp.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(it.quantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(it.unit_cost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(it.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payment history</CardTitle>
          {canAddPayment && exp.balance > 0 && !exp.deactivated_at && (
            <AddExpensePaymentDialog expenseId={exp.id} balance={exp.balance}>
              <Button size="sm">
                <CreditCard className="size-4" /> Record payment
              </Button>
            </AddExpensePaymentDialog>
          )}
        </CardHeader>
        <CardContent>
          {exp.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exp.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paid_on)}</TableCell>
                    <TableCell>{PAYMENT_MODE_LABELS[p.mode] ?? p.mode}</TableCell>
                    <TableCell className="font-mono text-xs">{p.transaction_id ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{p.notes ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono" : undefined}>{value || "—"}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
