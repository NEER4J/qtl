import Link from "next/link";
import { Download, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHelp } from "@/components/help/page-help";
import { StatementActions } from "@/components/reports/statement-actions";
import { getCustomerMonthlyStatement } from "@/lib/actions/statements";
import { requirePage } from "@/lib/auth/require";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { paymentModeLabel } from "@/lib/utils/payment-modes";
import { MONTH_RE, monthLabel, previousMonth } from "@/lib/utils/statement";
import { todayISO } from "@/lib/utils/tz";
import { StatementPicker } from "./statement-picker";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The current month and the 23 before it, newest first. */
function recentMonths(today: string, include: string): { value: string; label: string }[] {
  const [y, m] = today.split("-").map(Number);
  const values: string[] = [];
  for (let i = 0; i < 24; i++) {
    values.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
  }
  if (!values.includes(include)) values.push(include);
  return values.map((value) => ({ value, label: monthLabel(value) }));
}

export default async function CustomerStatementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePage("reports_customer_statement");
  const sp = await searchParams;
  const today = todayISO();
  // Default: the last full month — the statement you'd send out now.
  const month = sp.month && MONTH_RE.test(sp.month) ? sp.month : previousMonth(today);
  const customerId = sp.customer_id && UUID_RE.test(sp.customer_id) ? sp.customer_id : null;
  const statement = customerId ? await getCustomerMonthlyStatement(customerId, month) : null;
  const label = monthLabel(month);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customer statement</h1>
        <p className="text-sm text-muted-foreground">
          One customer, one month: what they owed going in, what they were billed and paid, and
          what they owe at the end. Print it, save the PDF or email it.
        </p>
      </div>

      <PageHelp id="reports-customer-statement">
        <p>A monthly account statement for one customer.</p>
        <ul>
          <li>
            <strong>Balance owing at the start</strong> — every earlier invoice not yet paid on the
            first of the month.
          </li>
          <li>
            <strong>Invoices</strong> — every invoice dated in the month, with what was paid on it
            and what was still owing at month end. Returns are store credit and show under it.
          </li>
          <li>
            <strong>Payments received</strong> — every payment taken in the month on any of the
            customer&apos;s invoices, with the method and reference.
          </li>
          <li>
            <strong>Balance owing at the end</strong> = start + invoices − store credit applied −
            payments (+ anything paid beyond what an invoice owed, which isn&apos;t a payment
            toward the balance).
          </li>
        </ul>
        <p>
          Email opens your own email app with the message written and a link to the PDF that works
          for 30 days — send it to the customer&apos;s address or type any other.
        </p>
      </PageHelp>

      <StatementPicker
        customerId={customerId}
        customerName={statement?.customer.name ?? null}
        month={month}
        months={recentMonths(today, month)}
      />

      {!customerId ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <UserRound className="size-5" />
            Pick a customer to see their statement for {label}. Search by name, phone or plate.
          </CardContent>
        </Card>
      ) : !statement ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            That customer wasn&apos;t found.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/customers/${statement.customer.id}`}
                  className="text-lg font-semibold hover:underline"
                >
                  {statement.customer.name}
                </Link>
                {statement.customer.code && (
                  <Badge variant="outline" className="font-mono">
                    {statement.customer.code}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {label} · statement date {formatDate(statement.end)}
                {statement.customer.email ? ` · ${statement.customer.email}` : " · no email on file"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatementActions
                customerId={statement.customer.id}
                month={month}
                monthLabel={label}
                customerName={statement.customer.name}
                customerEmail={statement.customer.email}
                statementDate={statement.end}
                closingBalance={statement.closing_balance}
                shopName={[statement.shop.business_name, statement.shop.name]
                  .filter(Boolean)
                  .join(" ")}
              />
              <Button asChild variant="ghost">
                <a
                  href={`/api/export/customer-statement?customer_id=${statement.customer.id}`}
                  download
                >
                  <Download className="size-4" /> All-time CSV
                </a>
              </Button>
            </div>
          </div>

          {statement.shops_only && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              This statement only covers invoices from{" "}
              <strong>{statement.shops_only.join(", ") || "your shop"}</strong> — the shops you have
              access to. If this customer also buys at another shop, those invoices aren&apos;t on it
              and the balances may be short. Ask an owner for the full statement.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label={`Owing ${formatDate(statement.start)}`} value={formatMoney(statement.opening_balance)} />
            <Stat
              label={`Invoices (${statement.invoices.length})`}
              value={formatMoney(statement.invoices_total)}
              hint={
                statement.credit_applied_total > 0
                  ? `${formatMoney(statement.credit_applied_total)} paid with store credit`
                  : undefined
              }
            />
            <Stat
              label={`Payments (${statement.payments.length})`}
              value={formatMoney(statement.payments_total)}
              hint={
                statement.overpayment_to_credit > 0
                  ? `${formatMoney(statement.overpayment_to_credit)} beyond what was owed`
                  : undefined
              }
            />
            <Stat
              label={`Owing ${formatDate(statement.end)}`}
              value={formatMoney(statement.closing_balance)}
              highlight={statement.closing_balance > 0}
              strong
            />
            <Stat
              label={`Owing today (${formatDate(statement.generated_on)})`}
              value={formatMoney(statement.balance_today)}
            />
            <Stat
              label="Store credit now"
              value={formatMoney(statement.store_credit.available_now)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Invoices — {label}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {statement.invoices.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No invoices this month.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Plate / unit</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Store credit</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Owing {formatDate(statement.end)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.invoices.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDate(r.job_date)}</TableCell>
                        <TableCell>
                          <Link href={`/sales/${r.id}`} className="font-mono text-sm hover:underline">
                            #{r.invoice_no}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {[r.plate, r.unit_no ? `Unit ${r.unit_no}` : null].filter(Boolean).join(" · ") || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.total)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.credit_applied > 0 ? formatMoney(r.credit_applied) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.paid)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.owing > 0 ? (
                            <span className="font-medium text-rose-600">{formatMoney(r.owing)}</span>
                          ) : (
                            formatMoney(0)
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(statement.invoices_total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {statement.credit_applied_total > 0
                          ? formatMoney(statement.credit_applied_total)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(statement.invoices.reduce((s, r) => s + r.paid, 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(statement.invoices.reduce((s, r) => s + r.owing, 0))}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments received — {label}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {statement.payments.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No payments received this month.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.payments.map((p) => (
                      <TableRow key={p.key}>
                        <TableCell>{formatDate(p.paid_on)}</TableCell>
                        <TableCell>{paymentModeLabel(p.mode)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.reference ?? (p.legacy ? "Recorded on the invoice" : "—")}
                        </TableCell>
                        <TableCell>
                          <Link href={`/sales/${p.job_id}`} className="font-mono text-sm hover:underline">
                            #{p.invoice_no}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4}>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(statement.payments_total)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>

          {statement.earlier_owing.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Earlier invoices still owing on {formatDate(statement.end)}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Plate / unit</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Owing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.earlier_owing.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDate(r.job_date)}</TableCell>
                        <TableCell>
                          <Link href={`/sales/${r.id}`} className="font-mono text-sm hover:underline">
                            #{r.invoice_no}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {[r.plate, r.unit_no ? `Unit ${r.unit_no}` : null].filter(Boolean).join(" · ") || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.total)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-rose-600">
                          {formatMoney(r.owing)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4}>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(statement.earlier_owing.reduce((s, r) => s + r.owing, 0))}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}

          {(statement.store_credit.lines.length > 0 ||
            statement.store_credit.opening !== 0 ||
            statement.store_credit.closing !== 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Store credit</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="text-muted-foreground">
                      <TableCell>{formatDate(statement.start)}</TableCell>
                      <TableCell>Credit at the start of the month</TableCell>
                      <TableCell />
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(statement.store_credit.opening)}
                      </TableCell>
                    </TableRow>
                    {statement.store_credit.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{formatDate(l.date)}</TableCell>
                        <TableCell>{l.description}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {l.invoice_no ? `#${l.invoice_no}` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(l.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>{formatDate(statement.end)}</TableCell>
                      <TableCell colSpan={2}>Credit at the end of the month</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(statement.store_credit.closing)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${strong ? "bg-muted/40" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${highlight ? "text-rose-600" : ""}`}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
