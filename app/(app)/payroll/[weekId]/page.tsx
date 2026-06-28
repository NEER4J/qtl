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
import { PageHelp } from "@/components/help/page-help";
import { requireProfile } from "@/lib/auth/require";
import { getPayrollWeek } from "@/lib/actions/payroll";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { hiddenColumnsForPage } from "@/lib/permissions/check";
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

  // Per-viewer column hides from profiles.hidden_columns["payroll"].
  const hidden = hiddenColumnsForPage(profile, "payroll");
  const show = (key: string) => !hidden.has(key);

  // Visible-column count for the entries table. Used to compute colSpan for
  // the cash-days sub-row so it spans the right width regardless of hides.
  // Always-on columns: Employee, Type, Cash, Actions (4).
  const entryVisibleCount =
    4 +
    (show("hours") ? 1 : 0) +
    (show("overtime") ? 1 : 0) +
    (show("gross") ? 1 : 0) +
    (show("holiday_vacation") ? 2 : 0) + // Holiday + Vac
    (show("ei_cpp") ? 3 : 0) + // EI, CPP, CPP2
    (show("income_tax") ? 1 : 0) +
    (show("benefits") ? 3 : 0) + // Er EI, Er CPP, WSIB
    (show("net_pay") ? 1 : 0);

  const canEdit =
    (profile.role === "owner" || profile.role === "co_owner" || profile.role === "accountant") ||
    (profile.role === "manager" && profile.location_id === week.location_id);
  const isDraft = week.status === "draft";
  const canAddEntry = canEdit && isDraft;

  const totalGross = week.entries.reduce(
    (s, e) =>
      s
      + e.gross_wages
      + e.overtime_wages
      + e.bonus
      + e.holiday_pay
      + e.misc_extra,
    0,
  );
  const totalDeductions = week.entries.reduce(
    (s, e) =>
      s
      + e.ei_employee
      + e.cpp_employee
      + e.cpp_employee2
      + e.income_tax
      + e.benefit_employee_deduction,
    0,
  );
  const totalNet = week.entries.reduce((s, e) => s + e.net_pay, 0);
  const totalCash = week.entries.reduce((s, e) => s + e.cash_total, 0);
  const totalEmployerRemittance = week.entries.reduce(
    (s, e) => s + e.ei_employer + e.cpp_employer + e.cpp_employer2 + e.wsib_employer,
    0,
  );
  const totalVacationAccrued = week.entries.reduce((s, e) => s + e.vacation_pay, 0);
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

      <PageHelp id="payroll-detail">
        <p>The weekly workflow:</p>
        <ol>
          <li><strong>Add entries</strong> (only while the week is in Draft) — one per employee working this week. Fill in hours, rate, bonus, extras, and benefits. EI / CPP / tax update as you type.</li>
          <li><strong>Daily cash</strong> — for management employees, click the &quot;Cash&quot; button to log cash paid on each day. The total rolls up into the cash column.</li>
          <li><strong>Approve</strong> — locks entries so the numbers can&apos;t change. Do this once hours are final.</li>
          <li><strong>Record payment</strong> — log the actual cheque numbers, e-transfer references, etc. as they go out.</li>
          <li><strong>Mark as paid</strong> — closes the week. From here on it counts in the payroll analytics.</li>
        </ol>
        <p>
          The four stat boxes at the top show Gross, Deductions, Net, and Cash for the whole week.
        </p>
      </PageHelp>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Stat label="Gross earnings" value={formatMoney(totalGross)} />
        <Stat label="Total deductions" value={formatMoney(totalDeductions)} />
        <Stat label="Net pay" value={formatMoney(totalNet)} highlight />
        <Stat label="Cash paid" value={formatMoney(totalCash)} />
        <Stat label="Employer remit." value={formatMoney(totalEmployerRemittance)} />
        <Stat label="Vacation accrued" value={formatMoney(totalVacationAccrued)} />
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
        <CardContent className="p-0 max-h-[calc(100vh-220px)] overflow-auto">
          {week.entries.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center space-y-2">
              <p className="font-medium text-foreground">No entries yet for this week.</p>
              {canAddEntry ? (
                <p>Click <strong>Add entry</strong> above and pick the employees who worked this week. You&apos;ll need at least one saved employee to pick from.</p>
              ) : (
                <p>You can&apos;t edit this week because it&apos;s {week.status === "approved" ? "already approved" : "marked as paid"}.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  {show("hours") && <TableHead className="text-right">Reg hrs</TableHead>}
                  {show("overtime") && <TableHead className="text-right">OT hrs</TableHead>}
                  {show("gross") && <TableHead className="text-right">Gross</TableHead>}
                  {show("holiday_vacation") && <TableHead className="text-right">Holiday</TableHead>}
                  {show("ei_cpp") && <TableHead className="text-right">EI</TableHead>}
                  {show("ei_cpp") && <TableHead className="text-right">CPP</TableHead>}
                  {show("ei_cpp") && <TableHead className="text-right">CPP2</TableHead>}
                  {show("income_tax") && <TableHead className="text-right">Tax</TableHead>}
                  {show("holiday_vacation") && <TableHead className="text-right">Vac</TableHead>}
                  {show("benefits") && <TableHead className="text-right">Er EI</TableHead>}
                  {show("benefits") && <TableHead className="text-right">Er CPP</TableHead>}
                  {show("benefits") && <TableHead className="text-right">WSIB</TableHead>}
                  {show("net_pay") && <TableHead className="text-right">Net pay</TableHead>}
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
                      {show("hours") && <TableCell className="text-right tabular-nums">{entry.hours}</TableCell>}
                      {show("overtime") && <TableCell className="text-right tabular-nums text-muted-foreground">{entry.overtime_hours || "—"}</TableCell>}
                      {show("gross") && <TableCell className="text-right tabular-nums">{formatMoney(entry.gross_wages + entry.overtime_wages + entry.bonus + entry.misc_extra)}</TableCell>}
                      {show("holiday_vacation") && <TableCell className="text-right tabular-nums text-muted-foreground">{entry.holiday_pay ? formatMoney(entry.holiday_pay) : "—"}</TableCell>}
                      {show("ei_cpp") && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(entry.ei_employee)}</TableCell>}
                      {show("ei_cpp") && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(entry.cpp_employee)}</TableCell>}
                      {show("ei_cpp") && <TableCell className="text-right tabular-nums text-muted-foreground">{entry.cpp_employee2 ? formatMoney(entry.cpp_employee2) : "—"}</TableCell>}
                      {show("income_tax") && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(entry.income_tax)}</TableCell>}
                      {show("holiday_vacation") && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(entry.vacation_pay)}</TableCell>}
                      {show("benefits") && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(entry.ei_employer)}</TableCell>}
                      {show("benefits") && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(entry.cpp_employer + entry.cpp_employer2)}</TableCell>}
                      {show("benefits") && <TableCell className="text-right tabular-nums text-muted-foreground">{entry.wsib_employer ? formatMoney(entry.wsib_employer) : "—"}</TableCell>}
                      {show("net_pay") && <TableCell className="text-right tabular-nums font-semibold">{formatMoney(entry.net_pay)}</TableCell>}
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
                        <TableCell colSpan={entryVisibleCount - 1} className="py-1.5 pl-8">
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
            <div className="p-8 text-sm text-muted-foreground text-center space-y-2">
              <p className="font-medium text-foreground">No payments recorded.</p>
              <p>When you actually pay employees (cheque, e-transfer, cash), click <strong>Record payment</strong> above so you have a paper trail.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
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
