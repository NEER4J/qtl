import { notFound } from "next/navigation";

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
import { listRecurringExpenses } from "@/lib/actions/recurring";
import { listActiveLocations, listActiveExpenseCategories } from "@/lib/actions/reference";
import { listVendors } from "@/lib/actions/vendors";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { RecurringExpenseDialog } from "@/components/settings/recurring-expense-dialog";
import { ProcessRecurringButton } from "@/components/settings/process-recurring-button";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function RecurringExpensesPage() {
  const profile = await requireProfile();
  if (profile.role !== "owner" && profile.role !== "manager") notFound();

  const [rows, locations, categories, vendors] = await Promise.all([
    listRecurringExpenses(),
    listActiveLocations(),
    listActiveExpenseCategories(),
    listVendors(),
  ]);

  const lastRunAt = rows.reduce<string | null>((max, r) => {
    if (!r.last_generated_on) return max;
    return !max || r.last_generated_on > max ? r.last_generated_on : max;
  }, null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recurring expenses</h1>
          <p className="text-sm text-muted-foreground">
            Auto-generate expense rows on a schedule.
            {" "}
            {lastRunAt
              ? <>Last auto-generation: <span className="font-medium text-foreground">{formatDate(lastRunAt)}</span>.</>
              : <span className="italic">No auto-generated rows yet.</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <ProcessRecurringButton />
          <RecurringExpenseDialog locations={locations} categories={categories} vendors={vendors}>
            <Button size="sm"><Plus className="size-4" /> New</Button>
          </RecurringExpenseDialog>
        </div>
      </div>

      <PageHelp id="settings-recurring">
        <p>
          Templates for expenses that repeat on a schedule — a monthly radio ad, a weekly cleaning service, an annual insurance premium. The system creates the expense for you on the scheduled day.
        </p>
        <ul>
          <li><strong>Monthly</strong> — pick a day between the 1st and 28th. The expense is created on that day every month.</li>
          <li><strong>Weekly</strong> — pick a day of the week (Monday, Tuesday, etc.).</li>
          <li><strong>Annual</strong> — pick a day of the month; the expense is created once a year in the same month as the start date.</li>
          <li><strong>Process due</strong> — creates any expenses that are due today but haven&apos;t been generated yet. It&apos;s safe to click more than once — you&apos;ll never get duplicates.</li>
        </ul>
      </PageHelp>

      <Card>
        <CardHeader>
          <CardTitle>Schedules</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center space-y-2">
              <p className="font-medium text-foreground">No recurring expenses set up yet.</p>
              <p>Click <strong>New</strong> above to add a template for anything that repeats — a monthly radio ad, a weekly cleaning service, an annual insurance premium. The system will create the expense on schedule.</p>
              <p>You&apos;ll need at least one shop and one expense category set up first.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Last generated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const vendorName = vendors.find((v) => v.id === r.vendor_id)?.name ?? "—";
                  const cadence =
                    r.frequency === "monthly" ? `Day ${r.day_of_month} each month`
                    : r.frequency === "annual" ? `Day ${r.day_of_month} each year`
                    : `${DOW_LABELS[r.day_of_week ?? 0]} each week`;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.description ?? "(no description)"}</div>
                        <div className="text-xs text-muted-foreground">{vendorName}</div>
                      </TableCell>
                      <TableCell className="text-sm">{cadence}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">—</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(r.amount)}</TableCell>
                      <TableCell className="text-sm">{r.last_generated_on ? formatDate(r.last_generated_on) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={r.active ? "default" : "secondary"} className="text-xs">
                          {r.active ? "Active" : "Paused"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <RecurringExpenseDialog locations={locations} categories={categories} vendors={vendors} existing={r}>
                          <Button variant="ghost" size="sm">Edit</Button>
                        </RecurringExpenseDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
