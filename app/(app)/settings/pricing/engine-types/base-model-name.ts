// Filter-variant rows (e.g. "4.6L V8" and "4.6L V8 With Bosch Filter") are
// separate engine_types rows on purpose — each is wired to its own
// engine_filters part/brand and priced independently (see getOilDetail). This
// strips the "With … Filter" suffix so they can be GROUPED for display (the
// Engine types table) and so the merge dialog can suggest the engines a
// duplicate most likely belongs with.
export function baseModelName(model: string): string {
  return model.replace(/\s+with\s+.*filter\s*$/i, "").trim();
}
