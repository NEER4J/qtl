import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHelp } from "@/components/help/page-help";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireProfile } from "@/lib/auth/require";
import { getAllFilterSellPrices, listPartCategories } from "@/lib/actions/pricing";
import { formatDate, formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function AllFilterPricePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const showCost = profile.role === "owner";

  const [{ rows, counter_premium, customer_supplies_labour, effective_date }, categories] =
    await Promise.all([
      getAllFilterSellPrices({
        category_id: sp.category_id,
        brand: sp.brand,
        q: sp.q,
      }),
      listPartCategories(),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">All filter sell price</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} filters · {effective_date ? `Effective ${formatDate(effective_date)}` : "Effective date not set"}
        </p>
      </div>

      <PageHelp id="pricing-all-filter-price">
        <p>
          One row per filter. Each row shows the four service-mode prices the counter staff need
          to look up: Without Service (counter sale + labour), With Service (installed), Over Counter
          (raw sale), and Customer Supplies Filter (labour only).
        </p>
        <ul>
          <li><strong>With Service</strong> = filter cost + MHSW + labour for installing it.</li>
          <li><strong>Without Service</strong> = With Service + ${counter_premium.toFixed(2)} counter premium.</li>
          <li><strong>Over Counter</strong> = same as With Service unless a per-part override is set.</li>
          <li><strong>Customer Supplies</strong> = flat ${customer_supplies_labour.toFixed(2)} labour fee.</li>
        </ul>
        <p>
          Counter premium and customer-supplies labour are set in{" "}
          <Link href="/settings/pricing" className="underline">Pricing catalogue admin</Link>.
        </p>
      </PageHelp>

      <form className="flex flex-wrap gap-3 items-center">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search part # or description" className="w-[280px]" />
        <Input name="brand" defaultValue={sp.brand ?? ""} placeholder="Brand" className="w-[160px]" />
        <select
          name="category_id"
          defaultValue={sp.category_id ?? ""}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="submit" className="h-9 px-3 rounded-md border bg-primary text-primary-foreground text-sm">
          Apply
        </button>
        {(sp.q || sp.brand || sp.category_id) && (
          <Link href="/pricing/all-filter-price" className="text-sm underline text-muted-foreground">
            Clear
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center space-y-3">
              <p className="font-medium text-foreground">
                {(sp.q || sp.brand) ? "No filters match your search." : "No filters added yet."}
              </p>
              {(sp.q || sp.brand) ? (
                <p>Try clearing the filters above.</p>
              ) : showCost ? (
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
                  <TableHead className="text-right">Over counter</TableHead>
                  <TableHead className="text-right">Customer supplies</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.category}</TableCell>
                    <TableCell className="text-sm">{r.brand}</TableCell>
                    <TableCell className="font-mono text-sm">{r.part_number}</TableCell>
                    <TableCell className="text-sm">{r.description ?? "—"}</TableCell>
                    {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.cost)}</TableCell>}
                    {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.mhsw_fee)}</TableCell>}
                    {showCost && <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(r.service_cost)}</TableCell>}
                    <TableCell className="text-right tabular-nums">{r.without_service != null ? formatMoney(r.without_service) : <span className="text-muted-foreground/60">—</span>}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{r.with_service != null ? formatMoney(r.with_service) : <span className="text-muted-foreground/60">—</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.over_counter != null ? formatMoney(r.over_counter) : <span className="text-muted-foreground/60">—</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.customer_supplies)}</TableCell>
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
