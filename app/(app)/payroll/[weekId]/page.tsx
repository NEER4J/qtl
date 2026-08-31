import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plus, CreditCard, Pencil } from "lucide-react";

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
import { deductionExemptions } from "@/lib/utils/payroll-flags";
import { PayrollEntryDialog } from "@/components/payroll/payroll-entry-dialog";
import { CashDailyDialog } from "@/components/payroll/cash-daily-dialog";
import { PayrollPaymentDialog } from "@/components/payroll/payroll-payment-dialog";
import { WeekStatusButton } from "@/components/payroll/week-status-button";
import { WeekFormDialog } from "@/components/payroll/week-form-dialog";
import { PayrollPrintMenu } from "@/components/payroll/payroll-print-menu";
import {
  DeleteEntryButton,
  DeletePaymentButton,
  DeleteWeekButton,
} from "@/components/payroll/delete-buttons";

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

  // Editing is no longer gated on the week still being in Draft (migration
  // 0134). Approved and paid weeks stay correctable — a wrong hour count found
  // after payday used to be permanent. Every change is audited.
  const canEdit =
    (profile.role === "owner" || profile.role === "co_owner" || profile.role === "accountant") ||
    (profile.role === "manager" && profile.location_id === week.location_id);
  const isDraft = week.status === "draft";

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

  // Picker for the payment dialog. Payments outlive entries — deleting an
  // entry leaves its disbursement record on the week — so any employee that
  // only appears in the payments list is carried in too, otherwise editing
  // that payment would open with an empty employee field.
  const employeeOptions = week.entries.map((e) => ({
    id: e.employee_id,
    name: e.employee_name,
  }));
  for (const p of week.payments) {
    if (!employeeOptions.some((o) => o.id === p.employee_id)) {
      employeeOptions.push({ id: p.employee_id, name: "Employee no longer on this week" });
    }
  }

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
        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          <PayrollPrintMenu weekId={week.id} />
          {canEdit && (
            <>
              <WeekFormDialog
                week={{
                  id: week.id,
                  location_id: week.location_id,
                  week_start: week.week_start,
                  period_weeks: week.period_weeks,
                  notes: week.notes,
                }}
              >
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" /> Edit week
                </Button>
              </WeekFormDialog>
              <DeleteWeekButton
                weekId={week.id}
                entryCount={week.entries.length}
                paymentCount={week.payments.length}
              />
              <WeekStatusButton weekId={week.id} currentStatus={week.status} />
            </>
          )}
        </div>
      </div>

      {canEdit && !isDraft && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 print:hidden">
          This week is <strong>{week.status}</strong>. Corrections are still allowed — every change
          is written to the audit log. Re-check the totals and any payments already recorded before
          you hand the numbers on.
        </p>
      )}

      <div className="print:hidden">
        <PageHelp id="payroll-detail">
          <p>The weekly workflow:</p>
          <ol>
            <li><strong>Add entries</strong> — one per employee working this week. Fill in hours, rate, bonus, extras, and benefits. EI / CPP / tax update as you type.</li>
            <li><strong>Daily cash</strong> — for management employees, click the &quot;Cash&quot; button to log cash paid on each day. The total rolls up into the cash column. Days already logged can be corrected or removed from that same dialog.</li>
            <li><strong>Approve</strong> — signs the numbers off once hours are final.</li>
            <li><strong>Record payment</strong> — log the actual cheque numbers, e-transfer references, etc. as they go out.</li>
            <li><strong>Mark as paid</strong> — closes the week. From here on it counts in the payroll analytics.</li>
          </ol>
          <p>
            <strong>Nothing here is locked.</strong> Entries, cash days, payments, and the week
            itself can be edited or deleted at any status, and the status can be moved back
            (Change status → Draft). Corrections are recorded in the audit log.
          </p>
          <p>
            <strong>EI, CPP, CPP2, income tax, vacation accrual, and WSIB are switches</strong> on
            each entry — turn off whatever doesn&apos;t apply (family members are usually EI-exempt;
            under 18 / over 70 is CPP-exempt) and both the employee and employer side drop to $0.
            The switches start from the person&apos;s defaults on{" "}
            <Link href="/payroll/employees" className="underline">Payroll → Employees</Link> and can be
            overridden for a single pay period. Anything switched off is listed under the
            employee&apos;s name in the table and on their pay stub.
          </p>
          <p>
            <strong>Print</strong> (top right) gives you the payroll register for the whole week,
            one pay stub per employee, or the same data as a CSV.
          </p>
          <p>
            The stat boxes at the top show Gross, Deductions, Net, Cash, Employer remittance, and
            Vacation accrued for the whole week.
          </p>
        </PageHelp>
      </div>

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
          {canEdit && (
            <PayrollEntryDialog weekId={week.id}>
              <Button size="sm" className="print:hidden">
                <Plus className="size-4" /> Add entry
              </Button>
            </PayrollEntryDialog>
          )}
        </CardHeader>
        <CardContent className="p-0 max-h-[calc(100vh-220px)] overflow-auto print:max-h-none print:overflow-visible">
          {week.entries.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center space-y-2">
              <p className="font-medium text-foreground">No entries yet for this week.</p>
              {canEdit ? (
                <p>Click <strong>Add entry</strong> above and pick the employees who worked this week. You&apos;ll need at least one saved employee to pick from.</p>
              ) : (
                <p>You don&apos;t have permission to edit this week&apos;s payroll.</p>
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
                {week.entries.map((entry) => {
                  // What this person is exempt from, so a $0 EI or tax column
                  // reads as deliberate rather than unfinished.
                  const exempt = deductionExemptions(entry);
                  return (
                  // Keyed Fragment: the entry row and its cash sub-row are
                  // siblings, so the key belongs on the wrapper, not the rows.
                  <Fragment key={entry.id}>
                    <TableRow>
                      <TableCell className="font-medium">
                        {entry.employee_name}
                        {exempt.length > 0 && (
                          <div className="text-xs font-normal text-muted-foreground">
                            No {exempt.join(", ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {entry.employee_payroll_type}
                        </Badge>
                      </TableCell>
                      {show("hours") && <TableCell className="text-right tabular-nums">{entry.hours}</TableCell>}
                      {show("overtime") && <TableCell className="text-right tabular-nums text-muted-foreground">{entry.overtime_hours || "—"}</TableCell>}
                      {show("gross") && <TableCell className="text-right tabular-nums">{formatMoney(entry.gross_wages + entry.overtime_wages + entry.bonus + entry.misc_extra)}</TableCell>}
                      {show("holiday_vacation") && (
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {entry.holiday_pay ? (
                            <>
                              {formatMoney(entry.holiday_pay)}
                              {entry.holiday_hours > 0 && (
                                <div className="text-[11px]">
                                  {entry.holiday_hours} × {formatMoney(entry.holiday_rate || entry.rate)}
                                </div>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      )}
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
                      <TableCell className="print:hidden">
                        <div className="flex gap-1 justify-end">
                          {canEdit && (
                            <PayrollEntryDialog weekId={week.id} existing={entry}>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">Edit</Button>
                            </PayrollEntryDialog>
                          )}
                          {entry.employee_payroll_type === "management" && canEdit && (
                            <CashDailyDialog
                              entryId={entry.id}
                              weekStart={week.week_start}
                              days={entry.cash_days}
                            >
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">Cash</Button>
                            </CashDailyDialog>
                          )}
                          {canEdit && (
                            <DeleteEntryButton entryId={entry.id} employeeName={entry.employee_name} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {entry.cash_days.length > 0 && (
                      <TableRow className="bg-muted/30">
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
                  </Fragment>
                  );
                })}
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
            <PayrollPaymentDialog weekId={week.id} employees={employeeOptions}>
              <Button size="sm" variant="outline" className="print:hidden">
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
                  <TableHead className="print:hidden" />
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
                      <TableCell className="print:hidden">
                        <div className="flex gap-1 justify-end">
                          {canEdit && (
                            <>
                              <PayrollPaymentDialog
                                weekId={week.id}
                                employees={employeeOptions}
                                existing={p}
                              >
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">Edit</Button>
                              </PayrollPaymentDialog>
                              <DeletePaymentButton paymentId={p.id} />
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t font-semibold">
                  <TableCell colSpan={4}>Total paid</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(totalPaid)}</TableCell>
                  <TableCell className="print:hidden" />
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
