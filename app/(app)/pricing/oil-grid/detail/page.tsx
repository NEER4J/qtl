import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { PrintButton } from "@/components/pricing/print-button";
import { requireProfile } from "@/lib/auth/require";
import { getOilChangeDetails } from "@/lib/actions/pricing";
import { formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function OilChangeDetailPage() {
  const profile = await requireProfile();
  const { rows } = await getOilChangeDetails();
  // Filter cost + labour are admin-only — staff and manager see brand
  // availability but not the cost numbers. Same rule as /pricing/oil-detail.
  const showCost = (profile.role === "owner" || profile.role === "co_owner") || profile.role === "accountant";

  // All distinct brands across all engines, ordered alphabetically — used as
  // table columns so each engine row shows its brand options side by side.
  const allBrands = Array.from(
    new Set(rows.flatMap((r) => r.brands.map((b) => b.brand))),
  ).sort();

  return (
    <div className="flex flex-col gap-6">
      {/* Wide table — print in landscape with the chrome hidden. */}
      <style>{"@media print { @page { size: landscape; margin: 0.4in; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"}</style>

      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Oil-change detailed pricing</h1>
          <p className="text-sm text-muted-foreground">
            Per-engine breakdown across filter brand options, labour, fuel and grease.{" "}
            <Link href="/pricing/oil-grid" className="underline text-foreground">
              Back to summary grid
            </Link>
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Oil-change detailed pricing</h1>
        <p className="text-xs">Per-engine breakdown across filter brand options, labour, fuel and grease</p>
      </div>

      <div className="print:hidden">
      <PageHelp id="pricing-oil-grid-detail">
        {showCost ? (
          <>
            <p>
              Each row is an engine. The brand columns show every filter brand wired up to that engine
              (Donaldson, Fleetguard, etc.). Each brand cell stacks <strong>filter cost</strong>{" "}
              (parts × quantity) on top of <strong>labour</strong> (the service cost charged for
              installing that filter set).
            </p>
            <ul>
              <li>
                <em>Fuel</em> and <em>Grease</em> are what the job consumes beyond the
                filters — the diesel treatment and grease items inside the package linked
                to that engine, at (cost + MHSW) × quantity. They run roughly $6–$10 a job
                and come straight off profit.
              </li>
              <li>
                An amber <em>—</em> means no package is linked to that engine, so its fuel
                and grease are <em>unknown</em>, not zero. Link it under{" "}
                <Link href="/settings/pricing/engine-types" className="underline">engine types</Link>.
              </li>
              <li>Add or change brand options for an engine on its detail page.</li>
            </ul>
          </>
        ) : (
          <>
            <p>
              Quick lookup of which filter brands we stock for each engine. A green ✓ means we have that
              brand wired up; a dash means we don&apos;t.
            </p>
            <p>
              For customer-facing sell prices, use the{" "}
              <Link href="/pricing/oil-grid" className="underline">Oil-change price grid</Link> or{" "}
              <Link href="/pricing/print-list" className="underline">Print list</Link>.
            </p>
          </>
        )}
      </PageHelp>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-sm text-muted-foreground text-center">
            No engines configured yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-0 max-h-[calc(100vh-220px)] overflow-auto print:max-h-none print:overflow-visible">
            <table className="w-full text-sm print:text-[10px]">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-muted/50">Engine</th>
                  <th className="text-right p-2 text-xs text-muted-foreground">Capacity</th>
                  {allBrands.map((b) => (
                    <th key={b} className="p-2 text-center min-w-[140px] border-l">
                      {b}
                    </th>
                  ))}
                  {showCost && <th className="p-2 text-right min-w-[90px] border-l">Fuel</th>}
                  {showCost && <th className="p-2 text-right min-w-[90px] border-l">Grease</th>}
                </tr>
                {showCost && (
                  <tr className="border-t text-xs text-muted-foreground">
                    <th />
                    <th />
                    {allBrands.map((b) => (
                      <th key={`${b}-sub`} className="border-l">
                        <div className="grid grid-cols-2 gap-1 px-1">
                          <span className="text-right">Filter</span>
                          <span className="text-right">Labour</span>
                        </div>
                      </th>
                    ))}
                    <th className="border-l" />
                    <th className="border-l" />
                  </tr>
                )}
              </thead>
              <tbody>
                {rows.map((r) => {
                  const byBrand = new Map(r.brands.map((b) => [b.brand, b]));
                  return (
                    <tr key={r.engine.id} className="border-t">
                      <td className="p-2 font-medium sticky left-0 bg-background z-10">
                        {r.engine.manufacturer} {r.engine.model}
                      </td>
                      <td className="p-2 text-right text-xs text-muted-foreground tabular-nums">
                        {Number(r.engine.oil_capacity_litres).toFixed(1)}L
                      </td>
                      {allBrands.map((b) => {
                        const slot = byBrand.get(b);
                        return (
                          <td key={b} className="p-1 border-l text-sm tabular-nums">
                            {slot ? (
                              showCost ? (
                                <div className="grid grid-cols-2 gap-1">
                                  <span className="text-right">{formatMoney(slot.filter_cost)}</span>
                                  <span className="text-right text-muted-foreground">
                                    {formatMoney(slot.labour)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-center block text-emerald-600">✓</span>
                              )
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                      {/* Fuel + grease come from the engine's package. No package
                          linked means the usage is UNKNOWN, so show "—", which
                          must not read as "this job burns no fuel or grease". */}
                      {showCost && (
                        <td className="p-1 border-l text-right tabular-nums text-sm">
                          {r.extras_known ? (
                            formatMoney(r.fuel)
                          ) : (
                            <span
                              className="text-amber-600 dark:text-amber-500"
                              title="No package linked to this engine — fuel usage unknown"
                            >
                              —
                            </span>
                          )}
                        </td>
                      )}
                      {showCost && (
                        <td className="p-1 border-l text-right tabular-nums text-sm">
                          {r.extras_known ? (
                            formatMoney(r.grease)
                          ) : (
                            <span
                              className="text-amber-600 dark:text-amber-500"
                              title="No package linked to this engine — grease usage unknown"
                            >
                              —
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
