// Strips a "With … Filter" suffix off an engine model. An engine sold with a
// choice of filter is one engine with filter options now (migration 0150), but
// rows entered the old way — one engine per filter brand — can still exist, and
// this is how the merge dialog spots the engine such a row most likely belongs
// with.
export function baseModelName(model: string): string {
  return model.replace(/\s+with\s+.*filter\s*$/i, "").trim();
}
