// Client-safe labels for Trans & Diff service kinds. Kept out of the
// "use server" action module so client components (pickers, package UI) can
// import the label helper directly.

export const TRANSMISSION_KIND_LABEL: Record<string, string> = {
  allison_trans: "Allison Transmission",
  diff: "Differential oil change",
  trans: "Transmission oil change",
  combined: "Combined Trans + Diff",
  specialty_trans: "Specialty Transmission",
  coolant_flush: "Coolant Flush",
};

export function transmissionKindLabel(kind: string): string {
  return TRANSMISSION_KIND_LABEL[kind] ?? kind;
}
