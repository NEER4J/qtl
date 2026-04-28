import { notFound } from "next/navigation";

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
import { listStatutoryRates } from "@/lib/actions/pricing";
import { StatutoryRateDialog } from "@/components/settings/statutory-rate-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const RATE_LABELS: Record<string, string> = {
  ei_employee: "EI (employee)",
  ei_employer_multiplier: "EI (employer multiplier)",
  cpp_employee: "CPP (employee)",
  cpp2_employee: "CPP2 (employee)",
};

export default async function StatutoryRatesPage() {
  const profile = await requireProfile();
  if (profile.role !== "owner") notFound();

  const rows = await listStatutoryRates();

  // Group by year
  const byYear = new Map<number, typeof rows>();
  for (const r of rows) {
    const arr = byYear.get(r.year) ?? [];
    arr.push(r);
    byYear.set(r.year, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Statutory rates</h1>
          <p className="text-sm text-muted-foreground">
            Federal EI and CPP rates. Update these at the start of each calendar year.
          </p>
        </div>
        <StatutoryRateDialog>
          <Button size="sm"><Plus className="size-4" /> Add / update</Button>
        </StatutoryRateDialog>
      </div>

      <PageHelp id="settings-statutory" defaultOpen>
        <p>
          Federal EI and CPP rates change every January. When they do, add a row for the new year here so the payroll calculations use the right numbers.
        </p>
        <ul>
          <li><strong>EI (employee)</strong> — the rate you deduct from employee pay.</li>
          <li><strong>EI (employer multiplier)</strong> — the employer side of EI (typically 1.4 times the employee rate).</li>
          <li><strong>CPP (employee)</strong> — CPP contribution rate on earnings up to the maximum.</li>
          <li><strong>CPP2 (employee)</strong> — the second-tier rate on earnings above the first maximum.</li>
          <li><strong>Max insurable / pensionable</strong> — the annual caps CRA publishes. The payroll calculation scales them down to a weekly amount automatically.</li>
          <li><strong>Basic exemption</strong> — the CPP exemption. Subtracted before the CPP rate is applied.</li>
        </ul>
        <p>
          CRA publishes new rates each year. Update this page before processing the first pay week of the new year.
        </p>
      </PageHelp>

      {byYear.size === 0 && (
        <Card>
          <CardContent className="pt-6 pb-6 text-sm text-muted-foreground text-center space-y-2">
            <p className="font-medium text-foreground">No rates configured yet.</p>
            <p>
              Payroll needs EI and CPP rates to calculate deductions correctly. Click <strong>Add / update</strong> above to enter this year&apos;s rates before running any pay weeks.
            </p>
            <p>
              The latest rates are published each January on the CRA website.
            </p>
          </CardContent>
        </Card>
      )}

      {Array.from(byYear.entries()).map(([year, yearRows]) => (
        <Card key={year}>
          <CardHeader><CardTitle>{year}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Max insurable</TableHead>
                  <TableHead className="text-right">Max pensionable</TableHead>
                  <TableHead className="text-right">Max pensionable (tier 2)</TableHead>
                  <TableHead className="text-right">Basic exemption</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{RATE_LABELS[r.type] ?? r.type}</TableCell>
                    <TableCell className="text-right tabular-nums">{(Number(r.rate) * 100).toFixed(4)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{r.annual_max_insurable ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.annual_max_pensionable ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.annual_max_pensionable2 ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.basic_exemption ?? "—"}</TableCell>
                    <TableCell>
                      <StatutoryRateDialog existing={r}>
                        <Button size="sm" variant="ghost">Edit</Button>
                      </StatutoryRateDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
