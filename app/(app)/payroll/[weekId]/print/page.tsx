import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/pricing/print-button";
import { requireProfile } from "@/lib/auth/require";
import { getPayrollWeek } from "@/lib/actions/payroll";
import { getAppSettings } from "@/lib/actions/reference";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { hiddenColumnsForPage } from "@/lib/permissions/check";
import { deductionExemptions } from "@/lib/utils/payroll-flags";

export const dynamic = "force-dynamic";

type Mode = "register" | "stubs";

/**
 * Printable payroll paperwork for one pay week, in two shapes:
 *
 *   register — the whole week on one landscape sheet, every employee a row,
 *              totalled at the bottom. This is the sheet that gets signed and
 *              filed, and the one the accountant works from.
 *   stubs    — one portrait pay statement per employee, page-broken so each
 *              person's stub can be handed out on its own.
 *
 * Both respect the viewer's hidden-column settings — printing must not become a
 * way around a column the owner hid on screen.
 */
export default async function PayrollPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ weekId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const profile = await requireProfile();
  const { weekId } = await params;
  const { mode: modeParam } = await searchParams;
  const mode: Mode = modeParam === "stubs" ? "stubs" : "register";

  const [found, settings] = await Promise.all([getPayrollWeek(weekId), getAppSettings()]);
  if (!found) notFound();
  // Re-bind after the guard: the closures below (sum/grossOf/…) don't inherit
  // narrowing from a destructured binding.
  const week = found;

  const hidden = hiddenColumnsForPage(profile, "payroll");
  const show = (key: string) => !hidden.has(key);

  const employer = week.location_invoice_name || settings.company_name;
  const periodLabel = `${formatDate(week.week_start)} → ${formatDate(week.week_end)}`;

  const sum = (fn: (e: (typeof week.entries)[number]) => number) =>
    week.entries.reduce((s, e) => s + fn(e), 0);

  const grossOf = (e: (typeof week.entries)[number]) =>
    e.gross_wages + e.overtime_wages + e.bonus + e.holiday_pay + e.misc_extra;
  const deductionsOf = (e: (typeof week.entries)[number]) =>
    e.ei_employee + e.cpp_employee + e.cpp_employee2 + e.income_tax + e.benefit_employee_deduction;

  return (
    <div className="flex flex-col gap-6">
      <style>
        {mode === "register"
          ? "@media print { @page { size: landscape; margin: 0.4in; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"
          : "@media print { @page { size: portrait; margin: 0.5in; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"}
      </style>

      {/* Screen-only toolbar */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3">
            <Link href={`/payroll/${week.id}`}><ChevronLeft className="size-4" /> Back to week</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">
            {mode === "register" ? "Payroll register" : "Pay stubs"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {periodLabel} · {week.location_name} · {week.entries.length} employee
            {week.entries.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/payroll/${week.id}/print?mode=${mode === "register" ? "stubs" : "register"}`}>
              {mode === "register" ? "Switch to pay stubs" : "Switch to register"}
            </Link>
          </Button>
          <PrintButton />
        </div>
      </div>

      {week.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground print:hidden">
          This week has no entries yet, so there is nothing to print.
        </p>
      ) : mode === "register" ? (
        <section className="text-sm">
          <header className="mb-3">
            <h2 className="text-xl font-bold">{employer}</h2>
            <p className="text-sm">Payroll register — {week.location_name}</p>
            <p className="text-xs">
              Pay period: {periodLabel} · Status: {week.status}
              {week.period_weeks === 2 ? " · Bi-weekly" : ""}
            </p>
          </header>

          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted print:bg-transparent">
                <Th className="text-left">Employee</Th>
                <Th className="text-left">Type</Th>
                {show("hours") && <Th>Reg hrs</Th>}
                {show("hours") && <Th>Rate</Th>}
                {show("overtime") && <Th>OT hrs</Th>}
                {show("gross") && <Th>Gross</Th>}
                {show("holiday_vacation") && <Th>Holiday</Th>}
                {show("ei_cpp") && <Th>EI</Th>}
                {show("ei_cpp") && <Th>CPP</Th>}
                {show("ei_cpp") && <Th>CPP2</Th>}
                {show("income_tax") && <Th>Tax</Th>}
                {show("holiday_vacation") && <Th>Vacation</Th>}
                {show("benefits") && <Th>Er EI</Th>}
                {show("benefits") && <Th>Er CPP</Th>}
                {show("benefits") && <Th>WSIB</Th>}
                {show("net_pay") && <Th>Net pay</Th>}
                <Th>Cash</Th>
              </tr>
            </thead>
            <tbody>
              {week.entries.map((e) => (
                <tr key={e.id}>
                  <Td className="text-left font-medium">
                    {e.employee_name}
                    {e.employee_code ? <span className="text-muted-foreground"> ({e.employee_code})</span> : null}
                    {deductionExemptions(e).length > 0 && (
                      <div className="font-normal text-[10px] text-muted-foreground">
                        No {deductionExemptions(e).join(", ")}
                      </div>
                    )}
                  </Td>
                  <Td className="text-left capitalize">{e.employee_payroll_type}</Td>
                  {show("hours") && <Td>{e.hours}</Td>}
                  {show("hours") && <Td>{formatMoney(e.rate)}</Td>}
                  {show("overtime") && <Td>{e.overtime_hours || "—"}</Td>}
                  {show("gross") && <Td>{formatMoney(grossOf(e))}</Td>}
                  {show("holiday_vacation") && (
                    <Td>
                      {formatMoney(e.holiday_pay)}
                      {e.holiday_hours > 0 && (
                        <div className="text-[9px] text-muted-foreground">
                          {e.holiday_hours} × {formatMoney(e.holiday_rate || e.rate)}
                        </div>
                      )}
                    </Td>
                  )}
                  {show("ei_cpp") && <Td>{formatMoney(e.ei_employee)}</Td>}
                  {show("ei_cpp") && <Td>{formatMoney(e.cpp_employee)}</Td>}
                  {show("ei_cpp") && <Td>{formatMoney(e.cpp_employee2)}</Td>}
                  {show("income_tax") && <Td>{formatMoney(e.income_tax)}</Td>}
                  {show("holiday_vacation") && <Td>{formatMoney(e.vacation_pay)}</Td>}
                  {show("benefits") && <Td>{formatMoney(e.ei_employer)}</Td>}
                  {show("benefits") && <Td>{formatMoney(e.cpp_employer + e.cpp_employer2)}</Td>}
                  {show("benefits") && <Td>{formatMoney(e.wsib_employer)}</Td>}
                  {show("net_pay") && <Td className="font-semibold">{formatMoney(e.net_pay)}</Td>}
                  <Td>{formatMoney(e.cash_total)}</Td>
                </tr>
              ))}
              <tr className="font-semibold">
                <Td className="text-left">Total</Td>
                <Td />
                {show("hours") && <Td>{sum((e) => e.hours)}</Td>}
                {show("hours") && <Td />}
                {show("overtime") && <Td>{sum((e) => e.overtime_hours)}</Td>}
                {show("gross") && <Td>{formatMoney(sum(grossOf))}</Td>}
                {show("holiday_vacation") && <Td>{formatMoney(sum((e) => e.holiday_pay))}</Td>}
                {show("ei_cpp") && <Td>{formatMoney(sum((e) => e.ei_employee))}</Td>}
                {show("ei_cpp") && <Td>{formatMoney(sum((e) => e.cpp_employee))}</Td>}
                {show("ei_cpp") && <Td>{formatMoney(sum((e) => e.cpp_employee2))}</Td>}
                {show("income_tax") && <Td>{formatMoney(sum((e) => e.income_tax))}</Td>}
                {show("holiday_vacation") && <Td>{formatMoney(sum((e) => e.vacation_pay))}</Td>}
                {show("benefits") && <Td>{formatMoney(sum((e) => e.ei_employer))}</Td>}
                {show("benefits") && <Td>{formatMoney(sum((e) => e.cpp_employer + e.cpp_employer2))}</Td>}
                {show("benefits") && <Td>{formatMoney(sum((e) => e.wsib_employer))}</Td>}
                {show("net_pay") && <Td>{formatMoney(sum((e) => e.net_pay))}</Td>}
                <Td>{formatMoney(sum((e) => e.cash_total))}</Td>
              </tr>
            </tbody>
          </table>

          <footer className="mt-6 flex justify-between text-xs">
            <div>Total deductions: <strong>{formatMoney(sum(deductionsOf))}</strong></div>
            <div className="w-64 border-t pt-1">Approved by (signature / date)</div>
          </footer>
        </section>
      ) : (
        <div className="flex flex-col gap-8">
          {week.entries.map((entry, i) => {
            const payments = week.payments.filter((p) => p.employee_id === entry.employee_id);
            const paid = payments.reduce((s, p) => s + p.amount, 0);
            return (
              <section
                key={entry.id}
                className={`text-sm border rounded-lg p-5 print:border-0 print:p-0 ${
                  i < week.entries.length - 1 ? "print:break-after-page" : ""
                }`}
              >
                <header className="flex items-start justify-between gap-6 border-b pb-3 mb-3">
                  <div>
                    <h2 className="text-lg font-bold">{employer}</h2>
                    <p className="text-xs">{week.location_name}</p>
                    {week.location_address && <p className="text-xs">{week.location_address}</p>}
                    {week.location_phone && <p className="text-xs">{week.location_phone}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">Pay statement</p>
                    <p className="text-xs">Pay period: {periodLabel}</p>
                    <p className="text-xs capitalize">Status: {week.status}</p>
                  </div>
                </header>

                <div className="mb-3">
                  <p className="text-base font-semibold">{entry.employee_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.employee_code ? `Employee #${entry.employee_code} · ` : ""}
                    <span className="capitalize">{entry.employee_payroll_type}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-xs uppercase tracking-wide mb-1">Earnings</h3>
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        {show("hours") && (
                          <StubRow
                            label={`Regular (${entry.hours} hrs @ ${formatMoney(entry.rate)})`}
                            value={entry.gross_wages}
                          />
                        )}
                        {!show("hours") && <StubRow label="Regular wages" value={entry.gross_wages} />}
                        {show("overtime") && entry.overtime_hours > 0 && (
                          <StubRow
                            label={`Overtime (${entry.overtime_hours} hrs @ ${formatMoney(entry.overtime_rate)})`}
                            value={entry.overtime_wages}
                          />
                        )}
                        {show("holiday_vacation") && entry.holiday_pay > 0 && (
                          <StubRow
                            label={
                              entry.holiday_hours > 0
                                ? `Holiday (${entry.holiday_hours} hrs @ ${formatMoney(entry.holiday_rate || entry.rate)})`
                                : "Holiday pay"
                            }
                            value={entry.holiday_pay}
                          />
                        )}
                        {entry.bonus > 0 && <StubRow label="Bonus" value={entry.bonus} />}
                        {entry.misc_extra > 0 && <StubRow label="Other taxable extras" value={entry.misc_extra} />}
                        {show("gross") && (
                          <StubRow label="Gross earnings" value={grossOf(entry)} bold border />
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h3 className="font-semibold text-xs uppercase tracking-wide mb-1">Deductions</h3>
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        {show("ei_cpp") && <StubRow label="EI" value={entry.ei_employee} />}
                        {show("ei_cpp") && <StubRow label="CPP" value={entry.cpp_employee} />}
                        {show("ei_cpp") && entry.cpp_employee2 > 0 && (
                          <StubRow label="CPP2" value={entry.cpp_employee2} />
                        )}
                        {show("income_tax") && <StubRow label="Income tax" value={entry.income_tax} />}
                        {entry.benefit_employee_deduction > 0 && (
                          <StubRow label="Benefits" value={entry.benefit_employee_deduction} />
                        )}
                        <StubRow label="Total deductions" value={deductionsOf(entry)} bold border />
                      </tbody>
                    </table>
                  </div>
                </div>

                {show("net_pay") && (
                  <div className="mt-4 flex items-baseline justify-between border-t pt-3">
                    <span className="font-semibold uppercase text-xs tracking-wide">Net pay</span>
                    <span className="text-xl font-bold tabular-nums">{formatMoney(entry.net_pay)}</span>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
                  {show("holiday_vacation") && (
                    <Memo label="Vacation accrued" value={formatMoney(entry.vacation_pay)} />
                  )}
                  {entry.cheque_amount > 0 && (
                    <Memo label="Cheque portion" value={formatMoney(entry.cheque_amount)} />
                  )}
                  {entry.cash_total > 0 && <Memo label="Cash paid" value={formatMoney(entry.cash_total)} />}
                  <Memo label="Paid to date (this period)" value={formatMoney(paid)} />
                </div>

                {entry.cash_days.length > 0 && (
                  <div className="mt-3 text-xs">
                    <h3 className="font-semibold uppercase tracking-wide mb-1">Daily cash</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {entry.cash_days.map((d) => (
                        <span key={d.id}>
                          {formatDate(d.day)}: <strong>{formatMoney(d.amount)}</strong>
                          {d.notes ? ` (${d.notes})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {payments.length > 0 && (
                  <div className="mt-3 text-xs">
                    <h3 className="font-semibold uppercase tracking-wide mb-1">Payments</h3>
                    <table className="w-full border-collapse">
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-0.5">{formatDate(p.paid_on)}</td>
                            <td className="py-0.5 capitalize">{p.mode}</td>
                            <td className="py-0.5 font-mono">{p.transaction_id ?? "—"}</td>
                            <td className="py-0.5 text-right tabular-nums">{formatMoney(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {deductionExemptions(entry).length > 0 && (
                  <p className="mt-3 text-xs">
                    <strong>Not deducted this period:</strong>{" "}
                    {deductionExemptions(entry).join(", ")}
                  </p>
                )}

                {entry.notes && <p className="mt-3 text-xs text-muted-foreground">{entry.notes}</p>}

                <div className="mt-6 flex justify-between text-xs">
                  <div className="w-56 border-t pt-1">Employee signature</div>
                  <div className="w-56 border-t pt-1">Date</div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`border border-foreground/40 p-1 text-right font-medium ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={`border border-foreground/30 p-1 text-right tabular-nums ${className}`}>
      {children}
    </td>
  );
}

function StubRow({
  label,
  value,
  bold,
  border,
}: {
  label: string;
  value: number;
  bold?: boolean;
  border?: boolean;
}) {
  return (
    <tr className={border ? "border-t" : undefined}>
      <td className={`py-0.5 ${bold ? "font-semibold" : ""}`}>{label}</td>
      <td className={`py-0.5 text-right tabular-nums ${bold ? "font-semibold" : ""}`}>
        {formatMoney(value)}
      </td>
    </tr>
  );
}

function Memo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2 print:border-foreground/30">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}
