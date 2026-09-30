"use client";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableHead } from "@/components/ui/table";
import {
  setOilLocationLimits,
  setOilLocationStock,
  type InventoryOilRow,
  type OilInventoryData,
} from "@/lib/actions/inventory";

import { StockTable } from "./stock-table";

const matchesOil = (r: InventoryOilRow, q: string) =>
  r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);

// Oils are measured in litres, so counts and thresholds are fractional (unlike
// the whole-number part counts).
export function OilInventoryTable({
  data,
  canEdit,
  canEditLimits = false,
}: {
  data: OilInventoryData;
  canEdit: boolean;
  /** Min/max thresholds are policy — owner/co_owner only (oil_location_limits RLS). */
  canEditLimits?: boolean;
}) {
  return (
    <StockTable
      rows={data.oils}
      locations={data.locations}
      canEdit={canEdit}
      canEditLimits={canEditLimits}
      limitsSupported={data.limits_supported}
      fractional
      noun="oils"
      totalLabel="Total (L)"
      searchPlaceholder="Search oil code or name…"
      matches={matchesOil}
      leadHeaders={
        <>
          <TableHead rowSpan={2} className="min-w-[220px]">Oil</TableHead>
          <TableHead rowSpan={2} className="min-w-[100px]">Type</TableHead>
        </>
      }
      renderLead={(r) => (
        <>
          <TableCell>
            <div className="font-medium">{r.code}</div>
            <div className="text-xs text-muted-foreground">{r.name}</div>
          </TableCell>
          <TableCell>
            {r.is_engine_oil ? (
              <Badge variant="secondary" className="text-xs">Engine oil</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Other fluid</Badge>
            )}
          </TableCell>
        </>
      )}
      saveQty={(oil_type_id, location_id, qty) =>
        setOilLocationStock({ oil_type_id, location_id, qty })
      }
      saveLimits={(oil_type_id, location_id, limit) =>
        setOilLocationLimits({ oil_type_id, location_id, ...limit })
      }
    />
  );
}
