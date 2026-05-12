"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  upsertEngineSellPrice,
  deleteEngineSellPrice,
} from "@/lib/actions/pricing";
import { formatMoney } from "@/lib/utils/format";

interface Props {
  engineId: string;
  oilTypeId: string;
  container: "bulk" | "gallon";
  /** Current effective sell price (override OR cost-up). */
  value: number | null;
  /** Whether the current value is an override (vs cost-up fallback). */
  isOverride: boolean;
  /** engine_sell_prices row id when isOverride; null otherwise. */
  overrideId: string | null;
}

function parseDollars(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function EditableSellingCell(props: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    props.value != null ? props.value.toFixed(2) : "",
  );
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(props.value != null ? props.value.toFixed(2) : "");
          setEditing(true);
        }}
        className={`inline-block w-full text-right tabular-nums px-2 py-1 rounded hover:bg-muted/60 ${props.isOverride ? "font-semibold" : "text-muted-foreground italic"}`}
        title={props.isOverride ? "Manual price — click to edit" : "Cost-up fallback — click to set anchor"}
      >
        {props.value != null ? formatMoney(props.value) : "—"}
      </button>
    );
  }

  function commit() {
    const trimmed = draft.trim();
    // Empty → delete override (revert to cost-up)
    if (!trimmed) {
      if (!props.overrideId) {
        setEditing(false);
        return;
      }
      startTransition(async () => {
        const res = await deleteEngineSellPrice({ id: props.overrideId! });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Reverted to cost-up");
        setEditing(false);
        router.refresh();
      });
      return;
    }
    const price = parseDollars(trimmed);
    if (price == null) {
      toast.error("Enter a positive dollar amount");
      return;
    }
    // No-op if same as current override
    if (props.isOverride && props.value != null && Math.abs(props.value - price) < 0.005) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await upsertEngineSellPrice({
        engine_type_id: props.engineId,
        oil_type_id: props.oilTypeId,
        container: props.container,
        sell_price: price,
        notes: null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Price saved");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <input
      autoFocus
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      disabled={isPending}
      placeholder="—"
      className="w-full text-right tabular-nums px-2 py-1 h-8 rounded border border-primary bg-background outline-none focus:ring-2 focus:ring-primary/40"
    />
  );
}
