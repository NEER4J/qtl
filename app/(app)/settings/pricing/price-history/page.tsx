import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHelp } from "@/components/help/page-help";
import { requireRole } from "@/lib/auth/require";
import { listPriceHistory } from "@/lib/actions/pricing";

export const dynamic = "force-dynamic";

const ENTITY_LABELS: Record<string, string> = {
  part: "Part",
  oil_type: "Oil type",
  service_cost: "Service cost",
};

const FIELD_LABELS: Record<string, string> = {
  cost: "Cost",
  list_price: "List price",
  mhsw_fee: "MHSW fee",
  bulk_cost_per_litre: "Bulk cost / L",
  gallon_cost_per_litre: "Gallon cost / L",
};

export default async function PriceHistoryPage() {
  await requireRole("owner", "co_owner");
  const rows = await listPriceHistory(500);

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Price history</h1>
        <p className="text-sm text-muted-foreground">
          Append-only audit of every change to part costs, oil costs, and service (labour) costs.
        </p>
      </div>

      <PageHelp id="settings-price-history">
        <p>
          Each row records a single field change — what it was before, what it became, who made the change, and when. Entries are written automatically when an owner edits a part, an oil type, or a service cost. Rows can&apos;t be edited or deleted from the app.
        </p>
      </PageHelp>

      <Card>
        <CardHeader>
          <CardTitle>Recent changes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No price changes recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-44">When</TableHead>
                  <TableHead className="w-32">Type</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead className="text-right">Old</TableHead>
                  <TableHead className="text-right">New</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead>Changed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const oldV = r.old_value == null ? null : Number(r.old_value);
                  const newV = r.new_value == null ? null : Number(r.new_value);
                  const delta = oldV != null && newV != null ? newV - oldV : null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {new Date(r.changed_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {ENTITY_LABELS[r.entity_type] ?? r.entity_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.entity_label}</TableCell>
                      <TableCell className="text-sm">{FIELD_LABELS[r.field] ?? r.field}</TableCell>
                      <TableCell className="text-right tabular-nums">{oldV != null ? oldV.toFixed(2) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{newV != null ? newV.toFixed(2) : "—"}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums text-xs ${
                          delta == null
                            ? "text-muted-foreground"
                            : delta > 0
                            ? "text-emerald-600"
                            : delta < 0
                            ? "text-red-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.changed_by_label ?? "system"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
