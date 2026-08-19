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
import { OilPriceLockControls } from "@/components/pricing/oil-price-lock-controls";
import { PrintButton } from "@/components/pricing/print-button";
import { requireProfile } from "@/lib/auth/require";
import { getOilDetail } from "@/lib/actions/pricing";
import { formatMoney } from "@/lib/utils/format";
import { excelOilLabel } from "@/lib/utils/oil-labels";

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

  const showCost = (profile.role === "owner" || profile.role === "co_owner") || profile.role === "accountant";
  const canEdit = (profile.role === "owner" || profile.role === "co_owner");
  const isLocked = data.lock?.is_live ?? false;

  const pct = (n: number | null) => n == null ? "—" : `${(n * 100).toFixed(1)}%`;

  return (
    <div className="flex flex-col gap-6">
      {/* Wide table — print in landscape with the chrome hidden. */}
      <style>{"@media print { @page { size: landscape; margin: 0.4in; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }"}</style>

      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {excelOilLabel(data.oil_type.code, data.oil_type.name)}{" "}
            <Badge variant="outline" className="ml-2 align-middle">{container}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.oil_type.name} · Per-engine breakdown: oil + filter + labour + tier premium → selling price
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && data.lock_supported && (
            <OilPriceLockControls
              oilTypeId={data.oil_type.id}
              container={data.container}
              lock={data.lock}
              engineCount={data.rows.length}
            />
          )}
          {canEdit && !data.lock_supported && (
            <span className="text-xs text-muted-foreground">
              Price lock needs migration 0122
            </span>
          )}
          <PrintButton />
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">
          {excelOilLabel(data.oil_type.code, data.oil_type.name)} — {container}
        </h1>
        <p className="text-xs">{data.oil_type.name} · per-engine price breakdown</p>
      </div>

      {/* Under review — the Computed column is a proposal, not the price. Kept
          on-screen AND in print so a shared copy can't be misread. */}
      <div className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200 print:border-black print:bg-transparent print:text-black print:text-[10px] print:py-1">
        <strong>Selling</strong> is the price we charge today. <strong>Computed</strong> is a
        proposed price — filter cost + oil cost + labour + tier premium, with no round-up —
        shown for review only. <strong>Δ</strong> is the difference between the two. Nothing
        changes until the Computed figures are confirmed.
      </div>

      {/* Selector strip */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className="text-xs text-muted-foreground">Oil type:</span>
        {data.oil_types.map((o) => (
          <Link
            key={o.id}
            href={`/pricing/oil-detail/${encodeURIComponent(o.code)}?container=${container}`}
            className={`px-2 py-1 rounded-md text-xs border ${o.code === data.oil_type.code ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
            title={o.name}
          >
            {excelOilLabel(o.code, o.name)}
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

      <div className="print:hidden">
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
          <li>
            <strong>Computed</strong> — the proposed selling price: filter cost + oil cost +
            labour + tier premium, exactly as the numbers add up (no .99 round-up). It is
            shown for checking only; <strong>Selling</strong> is still what the shop charges.
            <strong> Δ</strong> is Computed minus Selling.
          </li>
          {canEdit && data.lock_supported && (
            <li>
              <strong>Lock prices</strong> — snapshots today&apos;s Selling price for every
              engine on this page until the date you pick. While locked, jobs, the price grid
              and the print list all use the snapshot even if costs move underneath it.
              Same behaviour as a locked package.
            </li>
          )}
          <li><strong>Filter cost</strong> — sum of (part cost + MHSW) × qty for every filter wired to this engine.</li>
          <li><strong>Oil cost</strong> — per-litre cost × engine oil capacity.</li>
          <li><strong>Tier premium</strong> — flat $ based on oil capacity bracket (8–20L, 21–38L, 39–46L, 47+L).</li>
          <li><strong>Total cost</strong> = filter + oil + tier. Labour is <em>not</em> a cost — it&apos;s the labour charge for the job, shown in its own column and captured as profit.</li>
          <li>
            <strong>Labour</strong> — the <em>Labor charge</em> of the package linked to this
            engine in{" "}
            <Link href="/settings/pricing/engine-types" className="underline">
              engine types
            </Link>
            , shown separately from the cost. An engine with no package linked falls back to the
            summed part labour and is flagged in the column.
          </li>
          <li><strong>Cost %</strong> and <strong>Profit %</strong> are shown to owner / accountant only.</li>
        </ul>
      </PageHelp>
      </div>

      {isLocked && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Prices on this page are <strong>locked until {data.lock!.lock_until}</strong> —{" "}
          {data.lock!.item_count} snapshotted price{data.lock!.item_count === 1 ? "" : "s"} are
          being charged instead of the live catalogue. Unlock to edit.
        </div>
      )}

      {canEdit && !data.labour_link_supported && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200 print:hidden">
          Labour is still matched to packages by name, which misses most engines (the ones marked{" "}
          <span className="font-semibold">*</span> below). Apply{" "}
          <span className="font-mono text-xs">migration 0130</span> to link each engine to its
          package explicitly.
        </div>
      )}

      {canEdit && data.labour_link_supported && data.unlinked_labour_count > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200 print:hidden">
          <strong>{data.unlinked_labour_count}</strong> engine
          {data.unlinked_labour_count === 1 ? "" : "s"} below (marked{" "}
          <span className="font-semibold">*</span>) {data.unlinked_labour_count === 1 ? "has" : "have"}{" "}
          no labour package linked, so Labour is the summed part labour rather than a package
          charge.{" "}
          <Link href="/settings/pricing/engine-types" className="underline font-medium">
            Link them in engine types
          </Link>
          .
        </div>
      )}

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
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0 max-h-[calc(100vh-220px)] overflow-auto print:max-h-none print:overflow-visible">
          <Table className="print:text-[10px]">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Engine</TableHead>
                <TableHead className="text-right">Litres</TableHead>
                <TableHead className="text-right">Selling</TableHead>
                {/* TEMPORARY — proposed formula price, shown for verification
                    before it replaces Selling. (client 2026-08-07.) */}
                <TableHead className="text-right">
                  Computed
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    filter+oil+labour+tier
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  Δ
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    vs selling
                  </span>
                </TableHead>
                {showCost && <TableHead className="text-right">Filter cost</TableHead>}
                {showCost && <TableHead className="text-right">Oil cost</TableHead>}
                {showCost && (
                  <TableHead className="text-right">
                    Labour
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      package labor charge
                    </span>
                  </TableHead>
                )}
                {showCost && <TableHead className="text-right">Tier +</TableHead>}
                {showCost && <TableHead className="text-right">Total cost</TableHead>}
                {showCost && <TableHead className="text-right">Profit</TableHead>}
                {showCost && <TableHead className="text-right">Cost %</TableHead>}
                {showCost && <TableHead className="text-right">Profit %</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => {
                const delta =
                  r.computed_selling != null && r.selling != null
                    ? Math.round((r.computed_selling - r.selling) * 100) / 100
                    : null;
                return (
                <TableRow key={r.engine_id}>
                  <TableCell className="font-medium">{r.engine_name}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{r.oil_capacity_litres.toFixed(1)}L</TableCell>
                  <TableCell className="text-right p-1">
                    {r.locked_price != null ? (
                      // Locked: the snapshot is the price, and editing the
                      // anchor underneath it would be misleading.
                      <span
                        className="tabular-nums font-semibold"
                        title={`Locked until ${data.lock?.lock_until}`}
                      >
                        {formatMoney(r.locked_price)}
                      </span>
                    ) : canEdit ? (
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
                  <TableCell className="text-right tabular-nums">
                    {r.computed_selling != null ? formatMoney(r.computed_selling) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {delta == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : delta === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={delta > 0 ? "text-emerald-600" : "text-rose-600"}>
                        {delta > 0 ? "+" : "−"}{formatMoney(Math.abs(delta))}
                      </span>
                    )}
                  </TableCell>
                  {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.filter_cost)}</TableCell>}
                  {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.oil_cost)}</TableCell>}
                  {showCost && (
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      <span
                        className={r.service_cost_source === "parts" ? "text-amber-600 dark:text-amber-500" : undefined}
                        title={
                          r.service_cost_package
                            ? `From package "${r.service_cost_package}"`
                            : "No labour package linked — this is the summed part labour, not a package charge"
                        }
                      >
                        {formatMoney(r.service_cost)}
                        {r.service_cost_source === "parts" && " *"}
                      </span>
                    </TableCell>
                  )}
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
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
