import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus, CreditCard } from "lucide-react";

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
import { requireProfile } from "@/lib/auth/require";
import { getPayrollWeek, updatePayrollWeekStatus } from "@/lib/actions/payroll";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { PayrollEntryDialog } from "@/components/payroll/payroll-entry-dialog";
import { CashDailyDialog } from "@/components/payroll/cash-daily-dialog";
import { PayrollPaymentDialog } from "@/components/payroll/payroll-payment-dialog";
import { WeekStatusButton } from "@/components/payroll/week-status-button";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  approved: "outline",
  paid: "default",
};

export default async function PayrollWeekPage({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const profile = await requireProfile();
  const { weekId } = await params;
  const week = await getPayrollWeek(weekId);
  if (!week) notFound();

  const canEdit =
    profile.role === "owner" ||
    (profile.role === "manager" && profile.location_id === week.location_id);
  const isDraft = week.status === "draft";
  const canAddEntry = canEdit && isDraft;

  const totalGross = week.entries.reduce((s, e) => s + e.gross_wages + e.bonus + e.misc_extra, 0);
  const totalDeductions = week.entries.reduce(
    (s, e) => s + e.ei_employee + e.cpp_employee + e.income_tax + e.benefit_employee_deduction,
    0,
  );
  const totalNet = week.entries.reduce((s, e) => s + e.net_pay, 0);
  const totalCash = week.entries.reduce((s, e) => s + e.cash_total, 0);
  const totalPaid = week.payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href="/payroll"><ChevronLeft className="size-4" /> Back to payroll</Link>
          </Button>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {formatDate(week.week_start)} → {formatDate(week.week_end)}
            </h1>
            <Badge variant={STATUS_COLORS[week.status] as "default" | "secondary" | "outline"}>
              {week.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {week.location_name} · {week.entries.length} employee{week.entries.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canEdit && (
          <WeekStatusButton weekId={week.id} currentStatus={week.status} />
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Gross earnings" value={formatMoney(totalGross)} />
        <Stat label="Total deductions" value={formatMoney(totalDeductions)} />
        <Stat label="Net pay" value={formatMoney(totalNet)} highlight />
        <Stat label="Cash paid" value={formatMoney(totalCash)} />
      </div>

      {/* Entries table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Entries</CardTitle>
          {canAddEntry && (
            <PayrollEntryDialog weekId={week.id}>
              <Button size="sm">
                <Plus className="size-4" /> Add entry
              </Button>
            </PayrollEntryDialog>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {week.entries.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No entries yet. Add your first employee.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">EI</TableHead>
                  <TableHead className="text-right">CPP</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead className="text-right">Cash</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {week.entries.map((entry) => (
                  <>
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.employee_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {entry.employee_payroll_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{entry.hours}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(entry.rate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(entry.gross_wages + entry.bonus + entry.misc_extra)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(entry.ei_employee)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(entry.cpp_employee)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(entry.income_tax)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{formatMoney(entry.net_pay)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(entry.cash_total)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {canAddEntry && (
                            <PayrollEntryDialog weekId={week.id} existing={entry}>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">Edit</Button>
                            </PayrollEntryDialog>
                          )}
                          {entry.employee_payroll_type === "management" && canAddEntry && (
                            <CashDailyDialog entryId={entry.id} weekStart={week.week_start}>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">Cash</Button>
                            </CashDailyDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {entry.cash_days.length > 0 && (
                      <TableRow key={`${entry.id}-cash`} className="bg-muted/30">
                        <TableCell colSpan={10} className="py-1.5 pl-8">
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {entry.cash_days.map((d) => (
                              <span key={d.id}>
                                {formatDate(d.day)}: <span className="font-medium text-foreground">{formatMoney(d.amount)}</span>
                                {d.notes ? ` (${d.notes})` : ""}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payments</CardTitle>
          {canEdit && (
            <PayrollPaymentDialog weekId={week.id} employees={week.entries.map((e) => ({ id: e.employee_id, name: e.employee_name }))}>
              <Button size="sm" variant="outline">
                <CreditCard className="size-4" /> Record payment
              </Button>
            </PayrollPaymentDialog>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {week.payments.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No payments recorded.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {week.payments.map((p) => {
                  const emp = week.entries.find((e) => e.employee_id === p.employee_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.paid_on)}</TableCell>
                      <TableCell>{emp?.employee_name ?? "—"}</TableCell>
                      <TableCell className="capitalize">{p.mode}</TableCell>
                      <TableCell className="font-mono text-xs">{p.transaction_id ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatMoney(p.amount)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t font-semibold">
                  <TableCell colSpan={4}>Total paid</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(totalPaid)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {week.notes && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{week.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${highlight ? "text-emerald-600" : ""}`}>{value}</div>
    </div>
  );
}
