import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHelp } from "@/components/help/page-help";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePage } from "@/lib/auth/require";
import { accessibleLocationIds } from "@/lib/auth/locations";
import { listInventory, listOilInventory } from "@/lib/actions/inventory";
import { listStockTransfers } from "@/lib/actions/stock-transfers";
import { canUpdatePage } from "@/lib/permissions/check";
import { formatDate, formatMoney } from "@/lib/utils/format";
import { todayISO } from "@/lib/utils/tz";

import { TransferForm, type TransferItemOption } from "./transfer-form";

export const dynamic = "force-dynamic";

export default async function StockTransfersPage() {
  const profile = await requirePage("inventory");
  const [data, oilData, transfers] = await Promise.all([
    listInventory(),
    listOilInventory(),
    listStockTransfers(),
  ]);

  const canTransfer =
    ["owner", "co_owner", "manager", "supervisor"].includes(profile.role) &&
    canUpdatePage(profile, "inventory");
  const allowed = accessibleLocationIds(profile);
  const fromLocations = data.locations.filter((l) => !allowed || allowed.includes(l.id));

  const items: TransferItemOption[] = [
    ...data.parts.map((p) => ({
      key: `part:${p.id}`,
      label: `${p.part_number} — ${p.brand}${p.description ? ` · ${p.description}` : ""}`,
      qtyByLocation: p.qtyByLocation,
      unit: "",
    })),
    ...oilData.oils.map((o) => ({
      key: `oil:${o.id}`,
      label: `${o.code} — ${o.name} (oil)`,
      qtyByLocation: o.qtyByLocation,
      unit: "L",
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href="/inventory">
            <ChevronLeft className="size-4" /> Back to inventory
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Stock transfers</h1>
        <p className="text-sm text-muted-foreground">
          Move parts or oil from one location to another, at cost.
        </p>
      </div>

      <PageHelp id="inventory-transfers">
        <p>
          A transfer takes the quantity off the sending location and adds it to the receiving one
          in one step, and keeps a record of what moved, when, by whom and at what cost (the
          catalogue cost of the part, or the oil&apos;s bulk cost per litre).
        </p>
        <ul>
          <li>You can only send what the sending location has on hand.</li>
          <li>Transfers can&apos;t be edited or deleted. To undo one, transfer it back.</li>
          <li>Each transfer has a printable <strong>Note</strong> (TR- number, both shops, item, quantity, value, signature lines) to keep on file.</li>
          <li>Owner, Admin, managers and supervisors can transfer; everyone with Inventory can see the list.</li>
        </ul>
      </PageHelp>

      {transfers === null ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Transfers aren&apos;t switched on yet: the database update (migration 0167) needs applying.
        </div>
      ) : (
        <>
          {canTransfer && data.locations.length > 1 && (
            <Card>
              <CardHeader><CardTitle>New transfer</CardTitle></CardHeader>
              <CardContent>
                <TransferForm
                  locations={data.locations}
                  fromLocations={fromLocations}
                  items={items}
                  today={todayISO()}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardContent className="p-0">
              {transfers.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No transfers yet.</div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead className="w-28">Date</TableHead>
                      <TableHead>From → To</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Cost each</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{formatDate(t.transfer_date)}</TableCell>
                        <TableCell>{t.from_location} → {t.to_location}</TableCell>
                        <TableCell>{t.item}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {t.quantity}{t.kind === "oil" ? " L" : ""}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(t.unit_cost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(t.value)}</TableCell>
                        <TableCell>{t.created_by_name ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.notes ?? ""}</TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            <Link href={`/inventory/transfers/${t.id}`}>Note</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
