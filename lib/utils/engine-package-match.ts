/**
 * Matching an engine to the package that covers its oil change.
 *
 * The two name lists were typed years apart and never lined up: an exact
 * name match reaches only 27 of 69 engines ("Cummins ISX/X15" vs the package
 * "Cummins ISX / X15", "Ford F250/F350/F550/F650" vs "F250/350/550/650",
 * "Cat C7/C10/3126 …" vs "Cat C7/10/3126 …"). Matching on part composition is
 * worse — 9 engines match two or more packages, 29 match none.
 *
 * So the durable link is the explicit `engine_types.labour_package_id`
 * (migration 0130) and this module exists to PROPOSE those links, not to
 * resolve labour at read time. It only ever suggests; a proposal that isn't
 * unambiguous is reported as such and left to a person.
 *
 * The rules, in the order they cut:
 *   1. Family     — Cat / Cummins / Mack …, with the spelling variants the
 *                   data actually contains ("Max Force" == "MaxForce",
 *                   "Mitsubushi" == "Mitsubishi", "F250…" == Ford).
 *   2. Filter     — every engine and package is either OEM-filter,
 *                   Fleetguard, or silent about it. OEM and Fleetguard never
 *                   match each other; a silent name matches either, but ranks
 *                   below a name that agrees explicitly.
 *   3. Model      — digits are compared as digits ("C10" == "10", "MP7" == "7",
 *                   "F350" == "350"), letters as letters ("ISB" fits inside
 *                   "ISC / ISL / ISB"). Equal beats "one contains the other",
 *                   which beats nothing.
 *
 * Anything still tied is only auto-linkable when every tied package would
 * charge the same — same labour, same fuel, same grease. Then the choice
 * cannot change a number on the page.
 */

/** The bits of a package this module needs to rank and compare candidates. */
export interface MatchablePackage {
  id: string;
  name: string;
  labor_selling_price: number;
  /** Fuel + grease the package consumes, so ties can be tested for sameness. */
  fuel?: number;
  grease?: number;
}

export type MatchConfidence =
  /** One package, agreeing on family, filter brand and model. */
  | "exact"
  /** One package once the weaker signals are allowed (e.g. only one side names a filter). */
  | "likely"
  /** Several packages fit and they'd all charge the same — the pick can't change a number. */
  | "tied-identical"
  /** Several packages fit and they charge differently, or none fit at all. */
  | "ambiguous";

export interface EngineMatch {
  pkg: MatchablePackage | null;
  confidence: MatchConfidence;
  /** Every package that survived the rules, best first. */
  candidates: MatchablePackage[];
  /** Plain-English why, for the review dialog. */
  reason: string;
}

/** Spelling variants that mean the same engine family in this data. */
const FAMILY_PATTERNS: [RegExp, string][] = [
  [/max\s*force/, "maxforce"],
  [/mitsub[iu]shi/, "mitsubishi"],
  [/duramax|vortec/, "duramax"],
  [/\bford\b|\bf\d{3}\b/, "ford"],
  [/\bcat\b|caterpillar/, "cat"],
  [/cummins/, "cummins"],
  [/detroit/, "detroit"],
  [/\bhino\b/, "hino"],
  [/international|navistar/, "international"],
  [/isuzu/, "isuzu"],
  [/\bmack\b/, "mack"],
  [/mercedes/, "mercedes"],
  [/paccar/, "paccar"],
  [/volvo/, "volvo"],
];

/**
 * MaxForce IS International's engine line, so an "International Filter" on a
 * MaxForce package is that engine's OEM filter, not a third-party one.
 */
const OEM_ALIASES: Record<string, string[]> = {
  maxforce: ["maxforce", "international", "navistar"],
  international: ["international", "navistar", "maxforce"],
  mercedes: ["mercedes", "benz"],
  duramax: ["duramax", "gm", "acdelco"],
};

/**
 * Words that carry no model information in either list.
 *
 * "fleetguard" belongs here even though it is meaningful: the filter brand is
 * compared on its own axis by `filterBrand`, so leaving it in the model tokens
 * counted it twice. It made "Mack With Mack Filter" (model words: none, the
 * brand is the family) look like a closer model match to the brand-silent
 * engine "Mack Mack" than "Mack With Fleetguard Filter" (model words:
 * "fleetguard") — silently picking the $149.64 package over the $79.68 one on
 * a coin-flip. OEM brand words drop out already, as family aliases.
 */
const NOISE = new Set([
  "with", "filter", "filters", "and", "the", "series", "engine", "engines", "l",
  "fleetguard",
]);

export function engineFamily(name: string): string {
  const t = name.toLowerCase();
  for (const [re, family] of FAMILY_PATTERNS) if (re.test(t)) return family;
  return t.trim().split(/\s+/)[0] ?? "";
}

/** "oem" | "fleetguard" | null (the name doesn't say). */
export function filterBrand(name: string, family: string): "oem" | "fleetguard" | null {
  const m = name.toLowerCase().match(/([a-z]+)\s*filter/);
  if (!m) return null;
  const brand = m[1]!;
  if (brand === "fleetguard") return "fleetguard";
  const oem = OEM_ALIASES[family] ?? [family];
  return oem.includes(brand) ? "oem" : null;
}

/**
 * Model identity, split so digits and letters are compared on their own terms:
 * "C10" and "10" are the same model, "ISB" and "ISC" are not.
 */
function modelTokens(name: string, family: string): { digits: Set<string>; words: Set<string> } {
  const digits = new Set<string>();
  const words = new Set<string>();
  const familyWords = new Set([family, ...(OEM_ALIASES[family] ?? [])]);
  for (const raw of name.toLowerCase().split(/[^a-z0-9.]+/)) {
    const t = raw.replace(/\.$/, "");
    if (!t || NOISE.has(t) || familyWords.has(t)) continue;
    const num = t.match(/\d+(?:\.\d+)?/);
    if (num) digits.add(num[0]);
    else words.add(t);
  }
  return { digits, words };
}

const setsEqual = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((x) => b.has(x));
const contains = (big: Set<string>, small: Set<string>) => [...small].every((x) => big.has(x));
const eitherContains = (a: Set<string>, b: Set<string>) => contains(a, b) || contains(b, a);

const money = (n: number | undefined) => Math.round((Number(n) || 0) * 100);
/** Same labour, same fuel, same grease — the pick can't move a number. */
function chargesTheSame(a: MatchablePackage, b: MatchablePackage): boolean {
  return (
    money(a.labor_selling_price) === money(b.labor_selling_price) &&
    money(a.fuel) === money(b.fuel) &&
    money(a.grease) === money(b.grease)
  );
}

/**
 * Proposes the package for one engine. `engineName` is the full
 * "manufacturer model" string the pricing pages display.
 */
export function matchEngineToPackage(
  engineName: string,
  packages: MatchablePackage[],
): EngineMatch {
  const family = engineFamily(engineName);
  const eBrand = filterBrand(engineName, family);
  const eTok = modelTokens(engineName, family);

  const scored: { pkg: MatchablePackage; rank: number }[] = [];
  for (const pkg of packages) {
    if (engineFamily(pkg.name) !== family) continue;
    const pBrand = filterBrand(pkg.name, family);
    // An OEM filter is never a Fleetguard one. This is the rule that keeps
    // "Cat C7/10/3126 With Cat Filter" off the Fleetguard engine.
    if (eBrand && pBrand && eBrand !== pBrand) continue;

    const pTok = modelTokens(pkg.name, family);
    const digitsEqual = setsEqual(eTok.digits, pTok.digits);
    const digitsFit = digitsEqual || eitherContains(eTok.digits, pTok.digits);
    if (!digitsFit) continue;
    const wordsEqual = setsEqual(eTok.words, pTok.words);
    const wordsFit = wordsEqual || eitherContains(eTok.words, pTok.words);
    if (!wordsFit) continue;

    // Higher is better, and MODEL dominates. Ranking filter agreement first
    // matched "Mercedes Benz 4000" to "Mercedes Benz Sprinter" — the two names
    // agreed by both saying nothing about a filter, which beat the package that
    // actually names the 4000. Model identity is the stronger signal; filter
    // brand only separates packages that describe the same engine.
    const brandRank = eBrand === pBrand ? 2 : 1;
    const modelRank = digitsEqual && wordsEqual ? 2 : digitsEqual ? 1 : 0;
    scored.push({ pkg, rank: modelRank * 10 + brandRank });
  }

  if (scored.length === 0) {
    return {
      pkg: null,
      confidence: "ambiguous",
      candidates: [],
      reason: `No package matches "${engineName}" on family, filter brand and model.`,
    };
  }

  const best = Math.max(...scored.map((s) => s.rank));
  const top = scored.filter((s) => s.rank === best).map((s) => s.pkg);
  const others = scored
    .filter((s) => s.rank !== best)
    .sort((a, b) => b.rank - a.rank)
    .map((s) => s.pkg);

  if (top.length === 1) {
    const exact = best >= 22;
    return {
      pkg: top[0]!,
      confidence: exact ? "exact" : "likely",
      candidates: [...top, ...others],
      reason: exact
        ? "Family, filter brand and model all agree."
        : "Only one package in this family fits the model; the two names don't both spell out the filter.",
    };
  }

  if (top.every((p) => chargesTheSame(p, top[0]!))) {
    return {
      pkg: top[0]!,
      confidence: "tied-identical",
      candidates: [...top, ...others],
      reason: `${top.length} packages fit and all charge the same labour, fuel and grease.`,
    };
  }

  return {
    pkg: null,
    confidence: "ambiguous",
    candidates: [...top, ...others],
    reason: `${top.length} packages fit and they charge differently — pick the right filter brand.`,
  };
}
