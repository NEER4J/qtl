"use client";

import { TableCell, TableHead } from "@/components/ui/table";
import {
  setPartLocationLimits,
  setPartLocationStock,
  type InventoryData,
  type InventoryPartRow,
} from "@/lib/actions/inventory";

import { StockTable } from "./stock-table";

const matchesPart = (r: InventoryPartRow, q: string) =>
  r.part_number.toLowerCase().includes(q) ||
  r.brand.toLowerCase().includes(q) ||
  r.category.toLowerCase().includes(q) ||
  (r.description ?? "").toLowerCase().includes(q);

export function InventoryTable({
  data,
  canEdit,
  canEditLimits = false,
}: {
  data: InventoryData;
  canEdit: boolean;
  /** Min/max thresholds are policy — owner/co_owner only (part_location_limits RLS). */
  canEditLimits?: boolean;
}) {
  return (
    <StockTable
      rows={data.parts}
      locations={data.locations}
      canEdit={canEdit}
      canEditLimits={canEditLimits}
      limitsSupported={data.limits_supported}
      noun="parts"
      searchPlaceholder="Search part #, brand, category…"
      matches={matchesPart}
      leadHeaders={
        <>
          <TableHead rowSpan={2} className="min-w-[220px]">Part</TableHead>
          <TableHead rowSpan={2} className="min-w-[120px]">Category</TableHead>
        </>
      }
      renderLead={(r) => (
        <>
          <TableCell>
            <div className="font-medium">{r.part_number}</div>
            <div className="text-xs text-muted-foreground">
              {r.brand}
              {r.description ? ` · ${r.description}` : ""}
            </div>
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">{r.category}</TableCell>
        </>
      )}
      saveQty={(part_id, location_id, qty) => setPartLocationStock({ part_id, location_id, qty })}
      saveLimits={(part_id, location_id, limit) =>
        setPartLocationLimits({ part_id, location_id, ...limit })
      }
    />
  );
}
