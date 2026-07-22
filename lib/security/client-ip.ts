// ----------------------------------------------------------------------------
// Client IP extraction
// ----------------------------------------------------------------------------
// Used by the middleware (to decide the IP lock) and by /settings/ip-access
// (to show the admin the address they're currently on). Kept header-only so it
// works in both the Edge runtime and Server Components.
//
// Order matters. On Vercel `x-vercel-forwarded-for` and `x-real-ip` are set by
// the platform and cannot be spoofed by the client; `x-forwarded-for` is the
// generic fallback for other hosts and reverse proxies, where the leftmost
// entry is the original client.

const FORWARD_HEADERS = [
  "x-vercel-forwarded-for",
  "x-real-ip",
  "x-forwarded-for",
] as const;

export function clientIpFromHeaders(headers: Headers): string | null {
  for (const name of FORWARD_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    const first = raw.split(",")[0]?.trim();
    const ip = normalizeIp(first);
    if (ip) return ip;
  }
  return null;
}

/**
 * Strip the transport noise that shows up around a forwarded address:
 * `[2001:db8::1]:443` → `2001:db8::1`, `203.0.113.7:51820` → `203.0.113.7`,
 * `::ffff:203.0.113.7` (IPv4-mapped IPv6) → `203.0.113.7`.
 */
export function normalizeIp(value: string | undefined | null): string | null {
  if (!value) return null;
  let ip = value.trim();
  if (!ip) return null;

  // Bracketed IPv6, optionally with a port.
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];

  // IPv4 with a port — only strip when there's exactly one colon, otherwise
  // we'd mangle a bare IPv6 address.
  if (ip.split(":").length === 2 && ip.includes(".")) {
    ip = ip.split(":")[0];
  }

  // IPv4-mapped IPv6, as Node reports for IPv4 clients on a dual-stack socket.
  const mapped = ip.match(/^::ffff:((?:\d{1,3}\.){3}\d{1,3})$/i);
  if (mapped) ip = mapped[1];

  return ip || null;
}
