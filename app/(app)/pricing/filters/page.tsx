import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import {
  LiveFilterClear,
  LiveFilterCount,
  LiveFilterInput,
  LiveFilterProvider,
  LiveFilterRows,
} from "@/components/live-filter";
import { PageHelp } from "@/components/help/page-help";
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
import { listParts } from "@/lib/actions/pricing";
import { formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function FilterListPage() {
  const profile = await requireProfile();

  // The whole list; the filter bar narrows it in the browser (LiveFilter*),
  // where it used to submit a form that reloaded the page.
  const parts = await listParts();

  const showCost = (profile.role === "owner" || profile.role === "co_owner");

  return (
    <LiveFilterProvider
      // listParts' rules: every word in the part #, description or brand;
      // category exact. Brand now ignores case ("fram" finds FRAM).
      filters={{ q: "words", brand: "contains", category_id: "equals" }}
      rows={parts.map((p) => ({
        key: p.id,
        text: {
          q: `${p.part_number} ${p.description ?? ""} ${p.brand}`,
          brand: p.brand,
          category_id: p.category_id,
        },
      }))}
    >
    <div className="flex flex-col gap-6">
      {/* Wide table — print in landscape with the chrome hidden. */}
      <style>{"@media print { @page { size: landscape; margin: 0.4in; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"}</style>

      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Filter price list</h1>
          <p className="text-sm text-muted-foreground"><LiveFilterCount /> parts</p>
        </div>
        <PrintButton />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Filter price list</h1>
        <p className="text-xs"><LiveFilterCount /> parts</p>
      </div>

      <div className="print:hidden">
        <PageHelp id="pricing-filters">
          <ul>
            <li>Click <strong>Print</strong> (top right) for a clean copy or to save as PDF — the search box and help are hidden in print.</li>
            <li>Search by part number or description. You can also narrow down by category or brand.</li>
            <li><strong>List price</strong> is what you charge the customer at the counter.</li>
            <li>The cost column is visible to the owner only. Everyone else sees sell prices.</li>
          </ul>
        </PageHelp>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <LiveFilterInput name="q" placeholder="Search by part #, description or brand" className="w-[280px]" />
        <LiveFilterInput name="brand" placeholder="Brand" className="w-[160px]" />
        <LiveFilterClear className="text-sm underline text-muted-foreground">Clear</LiveFilterClear>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0 max-h-[calc(100vh-220px)] overflow-auto print:max-h-none print:overflow-visible">
          {parts.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center space-y-3">
              <p className="font-medium text-foreground">The catalogue is empty.</p>
              {(profile.role === "owner" || profile.role === "co_owner") ? (
                <>
                  <p>No parts have been added yet. Add one from the pricing catalogue admin.</p>
                  <div className="flex justify-center gap-2 pt-1">
                    <Link href="/settings/pricing/parts" className="underline text-foreground font-medium">
                      Add parts
                    </Link>
                    <span aria-hidden>·</span>
                    <Link href="/settings/pricing" className="underline text-foreground font-medium">
                      Pricing admin hub
                    </Link>
                  </div>
                </>
              ) : (
                <p>Ask the owner to add parts from the pricing catalogue admin before this list can be used.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Part #</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Service</TableHead>
                  {showCost && <TableHead className="text-right">Cost</TableHead>}
                  <TableHead className="text-right">List price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <LiveFilterRows
                  empty={
                    <TableRow>
                      <TableCell colSpan={showCost ? 7 : 6} className="py-8 text-center text-sm text-muted-foreground">
                        No parts match your search. Clear the filters above to see the full list.
                      </TableCell>
                    </TableRow>
                  }
                  items={parts.map((p) => ({
                    key: p.id,
                    node: (
                  <TableRow
                    className="[content-visibility:auto] [contain-intrinsic-size:auto_41px]"
                  >
                    <TableCell className="font-mono text-sm">{p.part_number}</TableCell>
                    <TableCell>{p.brand}</TableCell>
                    <TableCell className="text-sm">
                      {p.category}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({p.unit_of_measure})
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{p.description ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.service_cost_name ?? "—"}</TableCell>
                    {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(p.cost)}</TableCell>}
                    <TableCell className="text-right tabular-nums font-medium">{formatMoney(p.list_price)}</TableCell>
                  </TableRow>
                    ),
                  }))}
                />
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
    </LiveFilterProvider>
  );
}
