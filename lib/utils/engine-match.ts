// Which catalogue engines a vehicle's free-text "engine size" points at.
//
// The New Job form narrows its Engine list to the engines the vehicle's engine
// size names (client 2026-06-28). The match was a literal "contains", so many
// real values found nothing and the whole list opened with no engine chosen
// (client 2026-11-27: "the full list opens … the shortlist isn't coming").
// Counting the live vehicles, 1,435 of 7,586 were affected: DET60 (553), MP8
// (141), VOLVO D13 (128), DETROIT 60 (82), C13/15 (49), CAT15 (32), D60, MP7…
//
// Each stage is tried in order and the first that finds an engine wins, so a
// size that already matched literally behaves exactly as before.

export interface MatchableEngine {
  manufacturer: string;
  model: string;
  display_name: string;
}

/** Lower-case letters and digits only: "DET 60" / "Det-60" / "det60" all agree. */
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** What the shop writes for an engine family, to what the catalogue calls it. */
const ALIASES: Record<string, string> = {
  d60: "det60",
  s60: "det60",
  cat15: "c15",
  cat13: "c13",
  cat12: "c12",
};

/**
 * The names an engine answers to. The model "MP 7/8" is also "MP7" and "MP8",
 * "C13/C15" is also "C13" and "C15", "Volvo D12 / D13" is also "VOLVO D13".
 * A segment with no letters of its own ("8", "3126") borrows the first one's.
 */
function engineKeys(e: MatchableEngine): string[] {
  const keys = new Set<string>();
  const add = (s: string) => {
    const c = compact(s);
    if (c) keys.add(c);
  };
  add(e.display_name);
  add(e.model);
  add(`${e.manufacturer} ${e.model}`);
  const segments = e.model.split("/").map((s) => s.trim()).filter(Boolean);
  if (segments.length > 1) {
    const letters = /^[A-Za-z]+/.exec(segments[0]!)?.[0] ?? "";
    for (const seg of segments) {
      const full = /^[A-Za-z]/.test(seg) ? seg : `${letters}${seg}`;
      add(full);
      add(`${e.manufacturer} ${full}`);
    }
  }
  return [...keys];
}

export function matchEngines<T extends MatchableEngine>(engines: readonly T[], size: string): T[] {
  const raw = size.trim().toLowerCase();
  if (!raw) return [];

  // 1. The original rule: the size sits inside the engine's name or model.
  const literal = engines.filter(
    (e) => e.display_name.toLowerCase().includes(raw) || e.model.toLowerCase().includes(raw),
  );
  if (literal.length > 0) return literal;

  // 2. Same, ignoring spaces and punctuation, and with the aliases and
  //    alternatives above ("DET60", "MP8", "VOLVO D13", "C13/15").
  const sizeKey = compact(raw);
  const keysOf = new Map(engines.map((e) => [e, engineKeys(e)] as const));
  const probes = [sizeKey, ALIASES[sizeKey]].filter((p): p is string => Boolean(p));
  for (const probe of probes) {
    const hit = engines.filter((e) => keysOf.get(e)!.some((k) => k.includes(probe)));
    if (hit.length > 0) return hit;
  }

  // 3. Every word of the size appears in the engine's name, in any order
  //    ("D13 VOLVO", "DETROIT 60"). "DUMP" and "AXLES" notes are ignored.
  const words = raw
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !["dump", "axles", "axle", "truck", "tractor", "reg"].includes(w) && !/^\d+$/.test(w) || /^\d{2,}$/.test(w));
  if (words.length > 0) {
    const hit = engines.filter((e) => {
      const hay = keysOf.get(e)!.join(" ");
      return words.every((w) => hay.includes(compact(ALIASES[w] ?? w)));
    });
    if (hit.length > 0) return hit;
  }

  // 4. A trailing note in brackets: "ISX (DUMP)", "MP8 (DUMP)" → try the size
  //    without it.
  const bare = raw.replace(/\([^)]*\)/g, "").trim();
  if (bare && bare !== raw) return matchEngines(engines, bare);
  return [];
}
