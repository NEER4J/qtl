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
import { listParts } from "@/lib/actions/pricing";
import { formatMoney } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function FilterListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;

  const parts = await listParts({
    category_id: sp.category_id_id,
    brand: sp.brand,
    q: sp.q,
  });

  const showCost = profile.role === "owner";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Filter price list</h1>
        <p className="text-sm text-muted-foreground">{parts.length} parts</p>
      </div>

      <PageHelp id="pricing-filters">
        <ul>
          <li>Search by part number or description. You can also narrow down by category or brand.</li>
          <li><strong>List price</strong> is what you charge the customer at the counter.</li>
          <li>The cost column is visible to the owner only. Everyone else sees sell prices.</li>
        </ul>
      </PageHelp>

      <form className="flex flex-wrap gap-3">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search by part number or description" className="w-[280px]" />
        <Input name="brand" defaultValue={sp.brand ?? ""} placeholder="Brand" className="w-[160px]" />
        <button type="submit" className="hidden" />
      </form>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {parts.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center space-y-3">
              <p className="font-medium text-foreground">
                {(sp.q || sp.category_id || sp.brand) ? "No parts match your search." : "The catalogue is empty."}
              </p>
              {(sp.q || sp.category_id || sp.brand) ? (
                <p>Try clearing the filters above to see the full list.</p>
              ) : profile.role === "owner" ? (
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
              <TableHeader>
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
                {parts.map((p) => (
                  <TableRow key={p.id}>
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
