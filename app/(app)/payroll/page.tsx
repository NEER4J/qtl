import Link from "next/link";
import { Plus, Calendar, ChevronRight, Users, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { EmptyState } from "@/components/help/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePage } from "@/lib/auth/require";
import { accessibleLocationIds } from "@/lib/auth/locations";
import { listPayrollWeeks } from "@/lib/actions/payroll";
import { getAppSettings } from "@/lib/actions/reference";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { NewWeekDialog } from "@/components/payroll/week-form-dialog";
import { PayrollSettingsCard } from "@/components/payroll/payroll-settings-card";
import { PrintButton } from "@/components/pricing/print-button";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  approved: "outline",
  paid: "default",
};

export default async function PayrollPage() {
  const profile = await requirePage("payroll");
  // null = every location (owner / co_owner / accountant / all-locations
  // users); otherwise the shops this person may see (migration 0137).
  const weeks = await listPayrollWeeks(accessibleLocationIds(profile));

  const canCreate =
    profile.role === "owner"
    || profile.role === "co_owner"
    || profile.role === "manager"
    || profile.role === "accountant";
  // Vacation / WSIB rate editing is owner / co_owner only (matches the action).
  const canEditSettings = profile.role === "owner" || profile.role === "co_owner";
  const settings = canEditSettings ? await getAppSettings() : null;

  // ------- 12-month rolling totals -------
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  const ytd = weeks
    .filter((w) => new Date(w.week_start) >= cutoff)
    .reduce(
      (acc, w) => ({
        gross: acc.gross + w.total_gross,
        net: acc.net + w.total_net,
        deductions: acc.deductions + w.total_deductions,
        employer_cost: acc.employer_cost + w.total_employer_cost,
        vacation: acc.vacation + w.total_vacation_pay,
        cash: acc.cash + w.total_cash,
        paid: acc.paid + w.total_paid,
      }),
      { gross: 0, net: 0, deductions: 0, employer_cost: 0, vacation: 0, cash: 0, paid: 0 },
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">Weekly pay cycles across all locations</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          <Button asChild size="sm" variant="outline">
            <Link href="/payroll/employees">
              <Users className="size-4" /> Employees
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/api/export/payroll-weeks" download>
              <Download className="size-4" /> Export CSV
            </a>
          </Button>
          <PrintButton />
          {canCreate && (
            <NewWeekDialog>
              <Button size="sm">
                <Plus className="size-4" /> New week
              </Button>
            </NewWeekDialog>
          )}
        </div>
      </div>

      <div className="print:hidden">
      <PageHelp id="payroll-list">
        <p>
          Weekly pay cycles. The summary tiles below show rolling 12-month totals across every
          location you can see; the table lists each week with its own roll-up.
        </p>
        <ul>
          <li><strong>New week</strong> — pick a Sunday and a shop, weekly or bi-weekly. Each week moves through three states: Draft, Approved, Paid.</li>
          <li><strong>Everything stays editable.</strong> Entries, cash days, payments, and the week itself can be corrected or deleted at any status, and a week can be moved back to Draft. Changes are recorded in the audit log.</li>
          <li><strong>Printing</strong> — open a week for the payroll register and per-employee pay stubs. <strong>Print</strong> here gives you this list of weeks; <strong>Export CSV</strong> gives the same as a spreadsheet.</li>
          <li><strong>EI, CPP (tier 1 + 2), employer EI/CPP, and WSIB</strong> are calculated automatically from <Link href="/settings/statutory-rates" className="underline">Settings → Statutory Rates</Link>. The Vacation pay rate (4% default) and WSIB rate are set in the Payroll settings panel below.</li>
          <li><strong>Each of those is optional per person.</strong> EI, CPP, CPP2, income tax, vacation accrual, and WSIB are switches on every payroll entry, seeded from the employee&apos;s defaults on <Link href="/payroll/employees" className="underline">Employees</Link> — so an EI-exempt family member or a CPP-exempt worker over 70 is handled without hand-zeroing anything.</li>
          <li><strong>Employee vs management</strong> — management pay can include a cheque portion + daily cash; regular employees use just the standard fields.</li>
        </ul>
      </PageHelp>
      </div>

      {/* Rolling 12-month tiles */}
      {weeks.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Stat label="Gross (12 mo)" value={formatMoney(ytd.gross)} />
          <Stat label="Deductions" value={formatMoney(ytd.deductions)} />
          <Stat label="Net pay" value={formatMoney(ytd.net)} highlight />
          <Stat label="Employer cost" value={formatMoney(ytd.employer_cost)} />
          <Stat label="Vacation accrued" value={formatMoney(ytd.vacation)} />
          <Stat label="Cash paid" value={formatMoney(ytd.cash)} />
          <Stat label="Total paid" value={formatMoney(ytd.paid)} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pay weeks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {weeks.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No pay weeks yet"
              description={
                canCreate
                  ? "Start your first pay cycle by clicking New week above. Pick a Monday and a shop."
                  : "Your manager or owner hasn't set up any pay weeks yet. Check back after they do."
              }
            />
          ) : (
            <div className="max-h-[calc(100vh-220px)] overflow-auto print:max-h-none print:overflow-visible">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Employees</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net pay</TableHead>
                    <TableHead className="text-right">Employer cost</TableHead>
                    <TableHead className="text-right">Vacation</TableHead>
                    <TableHead className="text-right">Cash</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="print:hidden" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeks.map((w) => {
                    const empty = w.entry_count === 0;
                    return (
                      <TableRow key={w.id} className={empty ? "bg-muted/20" : undefined}>
                        <TableCell>
                          <Link href={`/payroll/${w.id}`} className="flex items-center gap-2 hover:underline">
                            <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium">{formatDate(w.week_start)}</span>
                            <span className="text-muted-foreground text-xs">→ {formatDate(w.week_end)}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{w.location_code}</span>
                          <span className="ml-2 text-sm">{w.location_name}</span>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{w.entry_count}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {empty ? <span className="text-muted-foreground/50">—</span> : formatMoney(w.total_gross)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {empty ? <span className="text-muted-foreground/50">—</span> : formatMoney(w.total_deductions)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {empty ? <span className="text-muted-foreground/50">—</span> : formatMoney(w.total_net)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {empty ? <span className="text-muted-foreground/50">—</span> : formatMoney(w.total_employer_cost)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {empty ? <span className="text-muted-foreground/50">—</span> : formatMoney(w.total_vacation_pay)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {empty ? <span className="text-muted-foreground/50">—</span> : formatMoney(w.total_cash)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {empty ? <span className="text-muted-foreground/50">—</span> : formatMoney(w.total_paid)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_COLORS[w.status] as "default" | "secondary" | "outline"}>
                            {w.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="print:hidden">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/payroll/${w.id}`}>
                              {empty ? "Add entries" : "View"}
                              <ChevronRight className="size-3.5 ml-1" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {settings && (
        <div className="print:hidden">
          <PayrollSettingsCard
            initial={{
              vacation_pay_rate: Number(settings.vacation_pay_rate ?? 0.04),
              wsib_rate: Number(settings.wsib_rate ?? 0),
            }}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${highlight ? "text-emerald-600" : ""}`}>{value}</div>
    </div>
  );
}
