import Link from "next/link";
import { Plus, Calendar } from "lucide-react";

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
import { requireProfile } from "@/lib/auth/require";
import { listPayrollWeeks } from "@/lib/actions/payroll";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { NewWeekDialog } from "@/components/payroll/new-week-dialog";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  approved: "outline",
  paid: "default",
};

export default async function PayrollPage() {
  const profile = await requireProfile();
  const locationId =
    profile.role === "manager" ? (profile.location_id ?? undefined) : undefined;

  const weeks = await listPayrollWeeks(locationId);

  const canCreate = profile.role === "owner" || profile.role === "manager";

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">Weekly pay cycles across all locations</p>
        </div>
        {canCreate && (
          <NewWeekDialog>
            <Button size="sm">
              <Plus className="size-4" /> New week
            </Button>
          </NewWeekDialog>
        )}
      </div>

      <PageHelp id="payroll-list">
        <p>
          Weekly pay cycles. You&apos;ll have one entry here for each shop&apos;s pay week — each is self-contained with its own employee entries and payment records.
        </p>
        <ul>
          <li><strong>New week</strong> — pick a Monday and a shop. Each week moves through three states: Draft, Approved, Paid.</li>
          <li><strong>Entries can only be edited while the week is in Draft.</strong> Once you approve or mark paid, the numbers are locked in.</li>
          <li><strong>EI, CPP, and income tax</strong> are calculated automatically using the rates from Settings → Statutory Rates. Those rates change every January, so remember to update them at year-end.</li>
          <li><strong>Employee vs management pay</strong> — management pay can include a cheque portion plus daily cash amounts; employee pay is just the standard fields.</li>
        </ul>
      </PageHelp>

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Entries</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeks.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{formatDate(w.week_start)}</span>
                        <span className="text-muted-foreground text-xs">→ {formatDate(w.week_end)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{w.location_code}</span>
                      <span className="ml-2 text-sm">{w.location_name}</span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{w.entry_count}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[w.status] as "default" | "secondary" | "outline"}>
                        {w.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/payroll/${w.id}`}>View</Link>
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
