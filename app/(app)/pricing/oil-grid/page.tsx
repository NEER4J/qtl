import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { PrintButton } from "@/components/pricing/print-button";
import { requireProfile } from "@/lib/auth/require";
import { getOilChangeGrid } from "@/lib/actions/pricing";
import { formatMoney } from "@/lib/utils/format";
import { excelOilLabel } from "@/lib/utils/oil-labels";

export const dynamic = "force-dynamic";

export default async function OilGridPage() {
  const profile = await requireProfile();
  const { engines, oilTypes, cells, hstRate } = await getOilChangeGrid();
  const isOwner = (profile.role === "owner" || profile.role === "co_owner");
  const hstPct = Math.round(hstRate * 1000) / 10;

  return (
    <div className="flex flex-col gap-6">
      {/* Wide grid — print in landscape with the chrome hidden. */}
      <style>{"@media print { @page { size: landscape; margin: 0.4in; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"}</style>

      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Oil-change price grid</h1>
          <p className="text-sm text-muted-foreground">
            {engines.length} engine{engines.length !== 1 ? "s" : ""} × {oilTypes.length} oil grade{oilTypes.length !== 1 ? "s" : ""}. Bulk / Gallon.{" "}
            <Link href="/pricing/oil-grid/detail" className="underline text-foreground">
              See per-brand filter + labour + grease breakdown
            </Link>
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Oil-change price grid</h1>
        <p className="text-xs">{engines.length} engines × {oilTypes.length} oil grades · Bulk / Gallon</p>
      </div>

      <div className="print:hidden">
      <PageHelp id="pricing-oil-grid">
        <p>
          The main pricing lookup. Rows are engines, columns are oil grades. Each cell shows both bulk and gallon prices.
        </p>
        <p>
          Prices are calculated from: oil cost × engine oil capacity, plus the cost of filters used on that engine, plus the labour for installing them, plus a flat premium that scales with oil capacity. Everything is rounded up to end in .99.
        </p>
        <ul>
          <li>When the owner updates an oil cost, every price in that column updates right away.</li>
          <li>When a filter cost changes or a filter set on an engine changes, that row updates.</li>
          <li>Bulk prices are pre-tax. For oils flagged taxable, the gallon column shows pre-tax and a smaller post-HST ({hstPct}%) figure underneath. Non-taxable gallons show only the pre-tax figure.</li>
        </ul>
      </PageHelp>
      </div>

      {engines.length === 0 || oilTypes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-sm text-muted-foreground text-center space-y-3 max-w-2xl mx-auto">
            <p className="text-base font-medium text-foreground">The price grid is empty.</p>
            <p>
              The grid needs at least one <strong>engine type</strong> and one <strong>oil type</strong> before it
              can show prices.
            </p>
            {isOwner ? (
              <>
                <p>Add them from the pricing catalogue admin:</p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <Link href="/settings/pricing/engine-types" className="underline text-foreground font-medium">
                    Add engine types
                  </Link>
                  <span aria-hidden>·</span>
                  <Link href="/settings/pricing/oil-types" className="underline text-foreground font-medium">
                    Add oil types
                  </Link>
                  <span aria-hidden>·</span>
                  <Link href="/settings/pricing" className="underline text-foreground font-medium">
                    Pricing admin hub
                  </Link>
                </div>
              </>
            ) : (
              <p>Ask the owner to add engine types and oil types from the pricing catalogue admin.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-0 max-h-[calc(100vh-220px)] overflow-auto print:max-h-none print:overflow-visible">
            <table className="w-full text-sm print:text-[10px]">
              <thead className="bg-muted/50 sticky top-0 z-20">
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-muted/50 z-10">Engine</th>
                  <th className="text-right p-2 text-xs text-muted-foreground">Capacity</th>
                  {oilTypes.map((o) => (
                    <th key={o.id} className="p-2 text-center min-w-[110px] border-l" colSpan={2} title={o.name}>
                      <div className="font-medium">{excelOilLabel(o.code, o.name)}</div>
                      <div className="text-xs text-muted-foreground font-normal">{o.code}</div>
                    </th>
                  ))}
                </tr>
                <tr className="border-t text-xs text-muted-foreground">
                  <th />
                  <th />
                  {oilTypes.flatMap((o) => [
                    <th key={`${o.id}-b`} className="p-1 text-right border-l">Bulk</th>,
                    <th key={`${o.id}-g`} className="p-1 text-right">Gallon</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {engines.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2 font-medium sticky left-0 bg-background z-10">{e.display_name}</td>
                    <td className="p-2 text-right text-xs text-muted-foreground tabular-nums">{Number(e.oil_capacity_litres).toFixed(1)}L</td>
                    {oilTypes.flatMap((o) => {
                      const c = cells.get(`${e.id}|${o.id}`);
                      return [
                        <td key={`${o.id}-b`} className="p-1 text-right tabular-nums text-sm border-l">
                          {c?.bulk != null ? formatMoney(c.bulk) : "—"}
                        </td>,
                        <td key={`${o.id}-g`} className="p-1 text-right tabular-nums text-sm text-muted-foreground">
                          {c?.gallon != null ? (
                            <div className="flex flex-col items-end leading-tight">
                              <span>{formatMoney(c.gallon)}</span>
                              {c.gallon_with_tax != null && (
                                <span className="text-[10px] text-muted-foreground/70">
                                  +tax {formatMoney(c.gallon_with_tax)}
                                </span>
                              )}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>,
                      ];
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
