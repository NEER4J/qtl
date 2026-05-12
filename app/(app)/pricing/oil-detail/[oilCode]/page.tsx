import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHelp } from "@/components/help/page-help";
import { EditableSellingCell } from "@/components/pricing/editable-selling-cell";
import { requireProfile } from "@/lib/auth/require";
import { getOilDetail } from "@/lib/actions/pricing";
import { formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function OilDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ oilCode: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requireProfile();
  const { oilCode } = await params;
  const sp = await searchParams;
  const container: "bulk" | "gallon" = sp.container === "gallon" ? "gallon" : "bulk";

  const data = await getOilDetail(decodeURIComponent(oilCode), container);
  if (!data) notFound();

  const showCost = profile.role === "owner" || profile.role === "accountant";
  const canEdit = profile.role === "owner";

  const pct = (n: number | null) => n == null ? "—" : `${(n * 100).toFixed(1)}%`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {data.oil_type.name}{" "}
          <Badge variant="outline" className="ml-2 align-middle">{container}</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          Per-engine breakdown: oil + filter + labour + tier premium → selling price
        </p>
      </div>

      {/* Selector strip */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Oil type:</span>
        {data.oil_types.map((o) => (
          <Link
            key={o.id}
            href={`/pricing/oil-detail/${encodeURIComponent(o.code)}?container=${container}`}
            className={`px-2 py-1 rounded-md text-xs border ${o.code === data.oil_type.code ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
            title={o.code}
          >
            {o.name}
          </Link>
        ))}
        <span className="mx-2 text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">Container:</span>
        {(["bulk", "gallon"] as const).map((c) => (
          <Link
            key={c}
            href={`/pricing/oil-detail/${encodeURIComponent(data.oil_type.code)}?container=${c}`}
            className={`px-2 py-1 rounded-md text-xs border ${c === container ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
          >
            {c}
          </Link>
        ))}
      </div>

      <PageHelp id="pricing-oil-detail">
        <p>
          Rows are engines. Same layout as the Excel{" "}
          <span className="font-mono">{data.oil_type.code}</span> tab — selling price, cost
          breakdown, and live profit/margin.
        </p>
        <ul>
          {canEdit && (
            <li>
              <strong>Click any Selling cell</strong> to set a manual anchor price. Bold values
              are manual; italic values fall back to cost-up. Clear the input and press Enter to
              revert a cell to cost-up.
            </li>
          )}
          <li><strong>Filter cost</strong> — sum of (part cost + MHSW) × qty for every filter wired to this engine.</li>
          <li><strong>Oil cost</strong> — per-litre cost × engine oil capacity.</li>
          <li><strong>Labour</strong> — sum of service costs across the engine&apos;s filters.</li>
          <li><strong>Tier premium</strong> — flat $ based on oil capacity bracket (8–20L, 21–38L, 39–46L, 47+L).</li>
          <li><strong>Cost %</strong> and <strong>Profit %</strong> are shown to owner / accountant only.</li>
        </ul>
      </PageHelp>

      {data.rows.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-sm text-muted-foreground text-center space-y-2">
            <p className="font-medium text-foreground">No engines configured yet.</p>
            <p>
              Add engines from{" "}
              <Link href="/settings/pricing/engine-types" className="underline">
                pricing catalogue admin
              </Link>{" "}
              before this page can show prices.
            </p>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Engine</TableHead>
                <TableHead className="text-right">Litres</TableHead>
                <TableHead className="text-right">Selling</TableHead>
                {showCost && <TableHead className="text-right">Filter cost</TableHead>}
                {showCost && <TableHead className="text-right">Oil cost</TableHead>}
                {showCost && <TableHead className="text-right">Labour</TableHead>}
                {showCost && <TableHead className="text-right">Tier +</TableHead>}
                {showCost && <TableHead className="text-right">Total cost</TableHead>}
                {showCost && <TableHead className="text-right">Profit</TableHead>}
                {showCost && <TableHead className="text-right">Cost %</TableHead>}
                {showCost && <TableHead className="text-right">Profit %</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.engine_id}>
                  <TableCell className="font-medium">{r.engine_name}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{r.oil_capacity_litres.toFixed(1)}L</TableCell>
                  <TableCell className="text-right p-1">
                    {canEdit ? (
                      <EditableSellingCell
                        engineId={r.engine_id}
                        oilTypeId={data.oil_type.id}
                        container={data.container}
                        value={r.selling}
                        isOverride={r.is_override}
                        overrideId={r.override_id}
                      />
                    ) : (
                      <span className={`tabular-nums ${r.is_override ? "font-semibold" : "text-muted-foreground italic"}`}>
                        {r.selling != null ? formatMoney(r.selling) : "—"}
                      </span>
                    )}
                  </TableCell>
                  {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.filter_cost)}</TableCell>}
                  {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.oil_cost)}</TableCell>}
                  {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.service_cost)}</TableCell>}
                  {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.volume_tier_premium)}</TableCell>}
                  {showCost && <TableCell className="text-right tabular-nums">{formatMoney(r.total_cost)}</TableCell>}
                  {showCost && (
                    <TableCell className={`text-right tabular-nums font-medium ${r.profit == null ? "" : r.profit < 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {r.profit == null ? <span className="text-muted-foreground/60">—</span> : formatMoney(r.profit)}
                    </TableCell>
                  )}
                  {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{pct(r.cost_pct)}</TableCell>}
                  {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{pct(r.profit_pct)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
