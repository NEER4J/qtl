import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";

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
import { PageHelp } from "@/components/help/page-help";
import { requireProfile } from "@/lib/auth/require";
import { getVendor, getVendorExpenseHistory } from "@/lib/actions/vendors";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "text-emerald-600",
  partial: "text-amber-600",
  outstanding: "text-rose-600",
};

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const [vendor, expenses] = await Promise.all([
    getVendor(id),
    getVendorExpenseHistory(id),
  ]);
  if (!vendor) notFound();

  const totalExpenses = expenses.reduce((s, e) => s + e.total, 0);
  const totalBalance = expenses.reduce((s, e) => s + e.balance, 0);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href="/vendors"><ChevronLeft className="size-4" /> Back to vendors</Link>
          </Button>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-semibold tracking-tight">{vendor.name}</h1>
            {!vendor.active && <Badge variant="secondary">Inactive</Badge>}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/export/vendor-statement?vendor_id=${vendor.id}`} download>
            <Download className="size-4" /> Statement CSV
          </a>
        </Button>
      </div>

      <PageHelp id="vendor-detail">
        <ul>
          <li><strong>Statement CSV</strong> — download a spreadsheet of every bill you&apos;ve had from this vendor. Useful for reconciling against their monthly statement.</li>
          <li><strong>Balance owing</strong> — total of unpaid amounts across all their bills.</li>
          <li>Click any row to open that expense, where you can record a payment or edit.</li>
        </ul>
      </PageHelp>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 space-y-3 text-sm">
            <Field label="Contact" value={vendor.contact_no} />
            <Field label="Email" value={vendor.email} />
            <Field label="Account no." value={vendor.account_no} />
            <Field label="Account type" value={vendor.account_type} />
            {vendor.notes && <Field label="Notes" value={vendor.notes} />}
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 md:col-span-2 gap-4">
          <Stat label="Total expenses" value={String(expenses.length)} />
          <Stat label="Total billed" value={formatMoney(totalExpenses)} />
          <Stat label="Balance owing" value={formatMoney(totalBalance)} highlight={totalBalance > 0} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No expenses yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.expense_date)}</TableCell>
                    <TableCell className="font-mono text-sm">{e.invoice_no ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium capitalize ${PAYMENT_STATUS_COLORS[e.payment_status] ?? ""}`}>
                        {e.payment_status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(e.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.balance > 0 ? (
                        <span className="text-rose-600 font-medium">{formatMoney(e.balance)}</span>
                      ) : (
                        formatMoney(0)
                      )}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/expenses/${e.id}`}>View</Link>
                      </Button>
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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${highlight ? "text-rose-600" : ""}`}>{value}</div>
    </div>
  );
}
