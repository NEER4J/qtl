import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import {
  LiveFilterClear,
  LiveFilterCount,
  LiveFilterInput,
  LiveFilterProvider,
  LiveFilterRows,
  LiveFilterSelect,
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
import { getAllFilterSellPrices, listPartCategories } from "@/lib/actions/pricing";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

/** One sell-tier cell. A tier held at a fixed price (parts.*_price override)
 *  ignores cost/margin edits, so mark it — otherwise the owner edits a part and
 *  cannot tell why the price here never moves. (client 2026-08-31.) */
function TierPrice({ value, fixed }: { value: number | null; fixed: boolean }) {
  if (value == null) return <span className="text-muted-foreground/60">—</span>;
  return (
    <span
      className={fixed ? "underline decoration-dotted underline-offset-4" : undefined}
      title={fixed ? "Fixed price — set on the part, ignores cost/margin" : undefined}
    >
      {formatMoney(value)}
    </span>
  );
}

export default async function AllFilterPricePage() {
  const profile = await requireProfile();
  const showCost = (profile.role === "owner" || profile.role === "co_owner");

  // The whole list; the filter bar narrows it in the browser (LiveFilter*),
  // where it used to submit a form that reloaded the page.
  const [{ rows, counter_premium, customer_supplies_labour, effective_date }, categories] =
    await Promise.all([getAllFilterSellPrices(), listPartCategories()]);

  return (
    <LiveFilterProvider
      // getAllFilterSellPrices' rules: every word in the part #, description or
      // brand; category exact. Brand now ignores case ("fram" finds FRAM).
      filters={{ q: "words", brand: "contains", category_id: "equals" }}
      rows={rows.map((r) => ({
        key: r.id,
        text: {
          q: `${r.part_number} ${r.description ?? ""} ${r.brand}`,
          brand: r.brand,
          category_id: r.category_id,
        },
      }))}
    >
    <div className="flex flex-col gap-6">
      {/* Wide table — print in landscape with the chrome hidden. */}
      <style>{"@media print { @page { size: landscape; margin: 0.4in; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"}</style>

      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All filter sell price</h1>
          <p className="text-sm text-muted-foreground">
            <LiveFilterCount /> filters · {effective_date ? `Effective ${formatDate(effective_date)}` : "Effective date not set"}
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">All filter sell price</h1>
        <p className="text-xs">
          <LiveFilterCount /> filters · {effective_date ? `Effective ${formatDate(effective_date)}` : "Effective date not set"}
        </p>
      </div>

      <div className="print:hidden">
      <PageHelp id="pricing-all-filter-price">
        <p>
          One row per filter. Each row shows the four service-mode prices the counter staff need
          to look up: Without Service, With Service, Over the Counter, and Customer Supplies Filter
          (labour only).
        </p>
        <ul>
          <li><strong>Over the Counter</strong> = the part&apos;s List price.</li>
          <li><strong>With Service</strong> = Total cost (incl. Buy MHSW) + ${counter_premium.toFixed(2)} service charge.</li>
          <li><strong>Without Service</strong> = Linked labour charge + List price.</li>
          <li><strong>Customer Supplies</strong> = flat ${customer_supplies_labour.toFixed(2)} labour fee.</li>
          <li>
            A filter marked <strong>bundled</strong> is included in a package, which has already
            charged for it — so adding that filter to a job on its own charges <strong>$0</strong> for
            With Service, and that&apos;s the price shown. The small figure underneath is what With
            Service works out to (<em>calc</em>) or the fixed price set on the part (<em>fixed</em>).
          </li>
        </ul>
        <p>
          Service charge and customer-supplies labour are set in{" "}
          <Link href="/settings/pricing" className="underline">Pricing catalogue admin</Link>.
        </p>
        <p>
          A price with a <span className="underline decoration-dotted underline-offset-4">dotted underline</span>{" "}
          is held at a <strong>fixed price</strong> set on the part itself, so it ignores the formulas
          above — editing the part&apos;s cost or margin will not move it. Clear the fixed price in{" "}
          <Link href="/settings/pricing/parts" className="underline">Parts catalogue</Link> → edit the
          part → <strong>Fixed sell prices</strong> to go back to the calculated price.
        </p>
      </PageHelp>
      </div>

      <div className="flex flex-wrap gap-3 items-center print:hidden">
        <LiveFilterInput name="q" placeholder="Search part #, description or brand" className="w-[280px]" />
        <LiveFilterInput name="brand" placeholder="Brand" className="w-[160px]" />
        <LiveFilterSelect
          name="category_id"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </LiveFilterSelect>
        <LiveFilterClear className="text-sm underline text-muted-foreground">Clear</LiveFilterClear>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0 max-h-[calc(100vh-220px)] overflow-auto print:max-h-none print:overflow-visible">
          {rows.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center space-y-3">
              <p className="font-medium text-foreground">No filters added yet.</p>
              {showCost ? (
                <p>
                  Add filters from the{" "}
                  <Link href="/settings/pricing/parts" className="underline">pricing catalogue</Link>.
                </p>
              ) : (
                <p>Ask the owner to add filters from the pricing catalogue.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Part #</TableHead>
                  <TableHead>Description</TableHead>
                  {showCost && <TableHead className="text-right">Cost</TableHead>}
                  {showCost && <TableHead className="text-right">MHSW</TableHead>}
                  {showCost && <TableHead className="text-right">Service</TableHead>}
                  <TableHead className="text-right">Without service</TableHead>
                  <TableHead className="text-right">With service</TableHead>
                  <TableHead className="text-right">Over the Counter</TableHead>
                  <TableHead className="text-right">Customer supplies</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <LiveFilterRows
                  empty={
                    <TableRow>
                      <TableCell colSpan={showCost ? 11 : 8} className="py-8 text-center text-sm text-muted-foreground">
                        No filters match your search. Clear the filters above to see the full list.
                      </TableCell>
                    </TableRow>
                  }
                  items={rows.map((r) => ({
                    key: r.id,
                    node: (
                  <TableRow>
                    <TableCell className="text-sm">{r.category}</TableCell>
                    <TableCell className="text-sm">{r.brand}</TableCell>
                    <TableCell className="font-mono text-sm">{r.part_number}</TableCell>
                    <TableCell className="text-sm">{r.description ?? "—"}</TableCell>
                    {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.cost)}</TableCell>}
                    {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.mhsw_fee)}</TableCell>}
                    {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.service_cost)}</TableCell>}
                    <TableCell className="text-right tabular-nums"><TierPrice value={r.without_service} fixed={r.fixed_tiers.without_service} /></TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {/* Bundled: a job charges $0 for With Service, so that is the
                          price shown (and printed). The calculated — or fixed —
                          figure stays visible underneath, because showing only
                          $0 is what prompted the 2026-09-08 "not calculating"
                          report. Client 2026-09-15 asked for the $0 back. */}
                      {r.in_package ? (
                        <div
                          className="flex flex-col items-end leading-tight"
                          title="Bundled in a package — a package already charges for this filter, so adding it to a job on its own charges $0 for With Service."
                        >
                          <span>{formatMoney(0)}</span>
                          {r.with_service != null && (
                            <span className="text-[10px] font-normal text-muted-foreground">
                              bundled · {r.fixed_tiers.with_service ? "fixed" : "calc"}{" "}
                              {formatMoney(r.with_service)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <TierPrice value={r.with_service} fixed={r.fixed_tiers.with_service} />
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums"><TierPrice value={r.over_counter} fixed={r.fixed_tiers.over_counter} /></TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.customer_supplies_options.length > 1 ? (
                        <div className="flex flex-col items-end">
                          {r.customer_supplies_options.map((v, i) => (
                            <span key={i}>{formatMoney(v)}</span>
                          ))}
                        </div>
                      ) : (
                        formatMoney(r.customer_supplies_options[0] ?? r.customer_supplies)
                      )}
                    </TableCell>
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
