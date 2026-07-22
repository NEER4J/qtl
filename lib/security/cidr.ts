// ----------------------------------------------------------------------------
// CIDR parsing / normalisation
// ----------------------------------------------------------------------------
// Postgres' `cidr` type is strict: it rejects a value with host bits set to the
// right of the netmask (203.0.113.7/24 is an error, 203.0.113.0/24 is fine).
// Rather than surface a raw PG error, we validate and normalise here so the
// admin gets a sentence they can act on, and so a bare address ("203.0.113.7")
// is accepted and stored as a /32.
//
// Shared by the zod schema (server) and the form dialog (client preview).

export type CidrResult =
  | { ok: true; value: string; kind: "ipv4" | "ipv6" }
  | { ok: false; error: string };

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
// Deliberately loose — Postgres does the authoritative IPv6 parse on insert.
const IPV6_RE = /^[0-9a-f:]+$/i;

export function normalizeCidr(input: string): CidrResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter an IP address or range." };

  const [addr, prefixPart, ...rest] = raw.split("/");
  if (rest.length) return { ok: false, error: "Use a single / for the prefix, e.g. 203.0.113.0/24." };

  const isV6 = addr.includes(":");
  const maxBits = isV6 ? 128 : 32;

  let prefix: number;
  if (prefixPart === undefined || prefixPart === "") {
    prefix = maxBits; // a bare address means "just this one machine"
  } else {
    if (!/^\d+$/.test(prefixPart)) {
      return { ok: false, error: "The prefix after / must be a number, e.g. /24." };
    }
    prefix = Number(prefixPart);
    if (prefix < 0 || prefix > maxBits) {
      return { ok: false, error: `The prefix must be between 0 and ${maxBits} for IPv${isV6 ? 6 : 4}.` };
    }
  }

  if (isV6) {
    if (!IPV6_RE.test(addr)) return { ok: false, error: "That doesn't look like a valid IPv6 address." };
    return { ok: true, value: `${addr.toLowerCase()}/${prefix}`, kind: "ipv6" };
  }

  const m = addr.match(IPV4_RE);
  if (!m) return { ok: false, error: "That doesn't look like a valid IP address." };
  const octets = m.slice(1, 5).map(Number);
  if (octets.some((o) => o > 255)) {
    return { ok: false, error: "Each part of an IPv4 address must be 0–255." };
  }

  // Zero the host bits and tell the admin if that changed what they typed —
  // silently rewriting 203.0.113.7/24 to 203.0.113.0/24 would quietly allow
  // 254 more machines than they asked for.
  const asInt = octets.reduce((acc, o) => (acc << 8) + o, 0) >>> 0;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const masked = (asInt & mask) >>> 0;
  if (masked !== asInt) {
    const network = [24, 16, 8, 0].map((s) => (masked >>> s) & 0xff).join(".");
    return {
      ok: false,
      error: `${addr}/${prefix} has host bits set — did you mean ${network}/${prefix} (the whole range) or ${addr} (just this address)?`,
    };
  }

  return { ok: true, value: `${octets.join(".")}/${prefix}`, kind: "ipv4" };
}

/**
 * Does `network` (a stored cidr) contain `ip`? Mirrors Postgres' `>>=`, but
 * only for IPv4 — IPv6 falls back to an exact match. This is UI sugar only
 * ("your current address is covered"); the authoritative check is in the DB.
 */
export function cidrContains(network: string, ip: string): boolean {
  if (!network || !ip) return false;
  if (network.includes(":") || ip.includes(":")) {
    return normalizeCidrLoose(network) === normalizeCidrLoose(ip);
  }
  const [netAddr, prefixPart] = network.split("/");
  const prefix = prefixPart === undefined ? 32 : Number(prefixPart);
  const net = ipv4ToInt(netAddr);
  const addr = ipv4ToInt(ip);
  if (net === null || addr === null || !Number.isFinite(prefix)) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return ((net & mask) >>> 0) === ((addr & mask) >>> 0);
}

function normalizeCidrLoose(value: string): string {
  const result = normalizeCidr(value);
  return result.ok ? result.value : value.trim().toLowerCase();
}

function ipv4ToInt(value: string): number | null {
  const m = value.trim().match(IPV4_RE);
  if (!m) return null;
  const octets = m.slice(1, 5).map(Number);
  if (octets.some((o) => o > 255)) return null;
  return octets.reduce((acc, o) => (acc << 8) + o, 0) >>> 0;
}

/** Human label for a stored cidr: hides the noisy /32 and /128 single-host suffix. */
export function formatCidr(value: string): string {
  return value.replace(/\/32$/, "").replace(/\/128$/, "");
}

/** How many addresses a rule admits — shown so a too-wide /8 is obvious. */
export function describeCidrScope(value: string): string {
  const [, prefixPart] = value.split("/");
  const prefix = Number(prefixPart);
  if (!Number.isFinite(prefix)) return "";
  if (value.includes(":")) return prefix === 128 ? "Single address" : `IPv6 /${prefix} range`;
  if (prefix === 32) return "Single address";
  const count = 2 ** (32 - prefix);
  return `${count.toLocaleString()} addresses`;
}
