import { Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { PrintButton } from "@/components/pricing/print-button";
import { requireProfile } from "@/lib/auth/require";
import { getMyPay } from "@/lib/actions/payroll";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  approved: "outline",
  paid: "default",
};

export default async function MyPayPage() {
  const profile = await requireProfile();
  const rows = await getMyPay();

  const totals = rows.reduce(
    (acc, r) => {
      const gross =
        r.gross_wages + r.overtime_wages + r.bonus + r.holiday_pay + r.misc_extra;
      const deductions =
        r.ei_employee +
        r.cpp_employee +
        r.cpp_employee2 +
        r.income_tax +
        r.benefit_employee_deduction;
      return {
        gross: acc.gross + gross,
        deductions: acc.deductions + deductions,
        net: acc.net + r.net_pay,
        vacation: acc.vacation + r.vacation_pay,
        paid: acc.paid + r.paid,
      };
    },
    { gross: 0, deductions: 0, net: 0, vacation: 0, paid: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <style>{"@media print { @page { size: landscape; margin: 0.4in; } }"}</style>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My pay</h1>
          <p className="text-sm text-muted-foreground">
            {profile.full_name} · your weekly pay summary
          </p>
        </div>
        {rows.length > 0 && (
          <div className="print:hidden">
            <PrintButton />
          </div>
        )}
      </div>

      <div className="print:hidden">
      <PageHelp id="my-pay">
        <p>
          Every pay week you appear on, with your gross pay, deductions, net pay, vacation accrued,
          and what&apos;s been paid out. These are your own records only.
        </p>
        <ul>
          <li><strong>Gross</strong> — regular + overtime + bonus + holiday + extras.</li>
          <li><strong>Deductions</strong> — EI, CPP, income tax, and any benefit deductions.</li>
          <li><strong>Net pay</strong> — what you take home after deductions.</li>
          <li>If something looks off, talk to your manager — they manage the numbers.</li>
        </ul>
      </PageHelp>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No pay records yet"
          description="Once you've been added to a pay week, your pay summary will show up here. If you think this is wrong, ask your manager to link your login to your employee record."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Gross (total)" value={formatMoney(totals.gross)} />
            <Stat label="Deductions" value={formatMoney(totals.deductions)} />
            <Stat label="Net pay" value={formatMoney(totals.net)} highlight />
            <Stat label="Vacation accrued" value={formatMoney(totals.vacation)} />
            <Stat label="Paid out" value={formatMoney(totals.paid)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pay weeks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[calc(100vh-320px)] overflow-auto print:max-h-none print:overflow-visible">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Week</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net pay</TableHead>
                      <TableHead className="text-right">Vacation</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const gross =
                        r.gross_wages + r.overtime_wages + r.bonus + r.holiday_pay + r.misc_extra;
                      const deductions =
                        r.ei_employee +
                        r.cpp_employee +
                        r.cpp_employee2 +
                        r.income_tax +
                        r.benefit_employee_deduction;
                      return (
                        <TableRow key={r.week_id}>
                          <TableCell>
                            <span className="font-medium">{formatDate(r.week_start)}</span>
                            <span className="text-muted-foreground text-xs"> → {formatDate(r.week_end)}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.location_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(gross)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatMoney(deductions)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatMoney(r.net_pay)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatMoney(r.vacation_pay)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatMoney(r.paid)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_COLORS[r.status] ?? "secondary"}>{r.status}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
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
