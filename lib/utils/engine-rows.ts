import type { EngineFilterOption, EngineType } from "@/lib/db/types";

// An engine sold with more than one filter brand has one PRICE per brand, so
// the price lists (oil-change grid, oil detail, print list) and the sales form
// work in rows, not engines: one row per engine, or one per filter option of an
// engine that has them (engine_filter_options, migration 0150).

export interface EnginePricingRow {
  /** Unique per row, and what prices, locks and filters are looked up by: the
   *  option's id, or the engine's id when it has no options. */
  key: string;
  engine_id: string;
  option_id: string | null;
  /** The engine as this row prices it — for an option its name carries the
   *  label ("Cat C12/3406 With Cat Filter") and its capacity and package are
   *  the option's. `id` is always the real engine id. */
  engine: EngineType;
}

/** The lookup key for anything stored per (engine, option). */
export function engineRowKey(engineId: string, optionId: string | null | undefined): string {
  return optionId ?? engineId;
}

export function sortFilterOptions<T extends Pick<EngineFilterOption, "sort_order" | "label">>(
  options: T[],
): T[] {
  return [...options].sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
  );
}

export function groupFilterOptions(
  options: EngineFilterOption[],
): Map<string, EngineFilterOption[]> {
  const byEngine = new Map<string, EngineFilterOption[]>();
  for (const o of sortFilterOptions(options)) {
    const list = byEngine.get(o.engine_type_id);
    if (list) list.push(o);
    else byEngine.set(o.engine_type_id, [o]);
  }
  return byEngine;
}

/** Engines in, priced rows out — engine order kept, options in their own order. */
export function expandEngineRows(
  engines: EngineType[],
  options: EngineFilterOption[],
): EnginePricingRow[] {
  const byEngine = groupFilterOptions(options);
  return engines.flatMap((e): EnginePricingRow[] => {
    const own = byEngine.get(e.id);
    if (!own || own.length === 0) {
      return [{ key: e.id, engine_id: e.id, option_id: null, engine: e }];
    }
    return own.map((o) => ({
      key: o.id,
      engine_id: e.id,
      option_id: o.id,
      engine: {
        ...e,
        model: `${e.model} ${o.label}`,
        display_name: `${e.display_name} ${o.label}`,
        oil_capacity_litres:
          o.oil_capacity_litres != null ? Number(o.oil_capacity_litres) : e.oil_capacity_litres,
        labour_package_id: o.package_id,
      },
    }));
  });
}
