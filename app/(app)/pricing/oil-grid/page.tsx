import { Card, CardContent } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import { requireProfile } from "@/lib/auth/require";
import { getOilChangeGrid } from "@/lib/actions/pricing";
import { formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function OilGridPage() {
  await requireProfile();
  const { engines, oilTypes, cells } = await getOilChangeGrid();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Oil-change price grid</h1>
        <p className="text-sm text-muted-foreground">
          {engines.length} engine{engines.length !== 1 ? "s" : ""} × {oilTypes.length} oil grade{oilTypes.length !== 1 ? "s" : ""}. Bulk / Gallon.
        </p>
      </div>

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
          <li>Prices shown here are before HST. Add 13% at invoice time.</li>
        </ul>
      </PageHelp>

      {engines.length === 0 || oilTypes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-sm text-muted-foreground text-center space-y-2 max-w-2xl mx-auto">
            <p className="text-base font-medium text-foreground">The price grid is empty.</p>
            <p>
              Before prices can be shown, someone needs to load the filter parts, engine types, and oil types from your old pricing spreadsheet. This is a one-time setup task.
            </p>
            <p>
              If the catalogue has already been loaded and you&apos;re still seeing this, get in touch — the data may not have been synced to this environment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-muted/50 z-10">Engine</th>
                  <th className="text-right p-2 text-xs text-muted-foreground">Capacity</th>
                  {oilTypes.map((o) => (
                    <th key={o.id} className="p-2 text-center min-w-[110px]" colSpan={2}>
                      <div className="font-medium">{o.code}</div>
                      <div className="text-xs text-muted-foreground font-normal">{o.name}</div>
                    </th>
                  ))}
                </tr>
                <tr className="border-t text-xs text-muted-foreground">
                  <th />
                  <th />
                  {oilTypes.map((o) => (
                    <>
                      <th key={`${o.id}-b`} className="p-1 text-right">Bulk</th>
                      <th key={`${o.id}-g`} className="p-1 text-right">Gallon</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {engines.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2 font-medium sticky left-0 bg-background z-10">{e.display_name}</td>
                    <td className="p-2 text-right text-xs text-muted-foreground tabular-nums">{Number(e.oil_capacity_litres).toFixed(1)}L</td>
                    {oilTypes.map((o) => {
                      const c = cells.get(`${e.id}|${o.id}`);
                      return (
                        <>
                          <td key={`${e.id}-${o.id}-b`} className="p-1 text-right tabular-nums text-sm">
                            {c?.bulk != null ? formatMoney(c.bulk) : "—"}
                          </td>
                          <td key={`${e.id}-${o.id}-g`} className="p-1 text-right tabular-nums text-sm text-muted-foreground">
                            {c?.gallon != null ? formatMoney(c.gallon) : "—"}
                          </td>
                        </>
                      );
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
