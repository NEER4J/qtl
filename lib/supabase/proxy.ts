import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";
import { clientIpFromHeaders } from "../security/client-ip";

// Routes the IP lock never applies to:
//   /auth      — sign-in / sign-out must stay reachable, otherwise a blocked
//                user can't even switch to an admin account.
//   /blocked   — the "you're not on an approved network" page itself.
//   /portal    — the customer invoice portal. Portal customers are external by
//                definition and were never expected on a shop network.
//   /api/cron  — Vercel cron hits this from Vercel's own IPs, not the shop's.
const IP_LOCK_EXEMPT = ["/auth", "/blocked", "/portal", "/api/cron"];

function isExemptFromIpLock(pathname: string): boolean {
  return IP_LOCK_EXEMPT.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isCronPath(pathname: string): boolean {
  return pathname === "/api/cron" || pathname.startsWith("/api/cron/");
}

// ----------------------------------------------------------------------------
// IP-lock verdict cookie. check_ip_access is a round trip to the database (in
// Seoul) on EVERY request, server actions included — the sales pickers paid it
// on each open and each search. When IP_VERDICT_SECRET is set, an ALLOWED
// verdict is remembered for a few minutes in a signed, httpOnly cookie bound to
// this user and this IP, and requests carrying a valid one skip the RPC.
//
//   * allow only — a denied or failed check is never cached, so adding an IP
//     to the allowlist takes effect on the very next request;
//   * the cost is that removing an IP, deactivating a user or switching the
//     lock on takes up to IP_VERDICT_TTL_S to bite;
//   * unset IP_VERDICT_SECRET and this is off — every request runs the RPC,
//     exactly as before.
// HMAC through Web Crypto: middleware runs on the Edge runtime.
// ----------------------------------------------------------------------------
const IP_VERDICT_COOKIE = "qtl_ip_ok";
const IP_VERDICT_TTL_S = 5 * 60;

async function signVerdict(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hasValidVerdict(
  request: NextRequest,
  secret: string,
  userId: string,
  ip: string,
): Promise<boolean> {
  const raw = request.cookies.get(IP_VERDICT_COOKIE)?.value;
  if (!raw) return false;
  const [expText, sig] = raw.split(".");
  const exp = Number(expText);
  if (!sig || !Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  return sameString(sig, await signVerdict(secret, `${userId}|${ip}|${exp}`));
}

export async function updateSession(request: NextRequest) {
  // Surface the current pathname to Server Components / layouts via a request
  // header. Next.js doesn't expose pathname to layouts otherwise, and the
  // (app) layout needs it to enforce per-user `allowed_pages` overrides.
  request.headers.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // /api/cron has no session — Vercel cron authenticates with CRON_SECRET,
  // which the route itself checks. Redirecting it to the login page meant the
  // scheduled job never ran.
  if (
    request.nextUrl.pathname !== "/" &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !isCronPath(request.nextUrl.pathname)
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // --------------------------------------------------------------------------
  // IP lock — only approved networks may use the platform (Settings → IP
  // Access). Enforced here rather than in the (app) layout so it also covers
  // API routes and server actions, which never re-render the layout.
  // --------------------------------------------------------------------------
  if (user && !isExemptFromIpLock(request.nextUrl.pathname)) {
    const ip = clientIpFromHeaders(request.headers);
    const verdictSecret = process.env.IP_VERDICT_SECRET;
    const userId = typeof user.sub === "string" ? user.sub : null;
    const canCache = Boolean(verdictSecret && userId && ip);

    if (canCache && (await hasValidVerdict(request, verdictSecret!, userId!, ip!))) {
      return supabaseResponse;
    }

    // One round trip: the DB decides, because the allowlist and the master
    // switch aren't readable by ordinary roles. `check_ip_access` also handles
    // the Admin bypass and the "enabled but no rules yet" escape hatch.
    const { data: verdict, error: verdictError } = await supabase.rpc(
      "check_ip_access",
      { p_ip: ip ?? "" },
    );

    if (!verdictError && canCache && !(verdict?.enforced && !verdict?.allowed)) {
      // Allowed (or the lock is off): remember it on the response getClaims
      // may already have replaced, so the auth cookies it set still go out.
      const exp = Math.floor(Date.now() / 1000) + IP_VERDICT_TTL_S;
      supabaseResponse.cookies.set(
        IP_VERDICT_COOKIE,
        `${exp}.${await signVerdict(verdictSecret!, `${userId}|${ip}|${exp}`)}`,
        {
          httpOnly: true,
          secure: request.nextUrl.protocol === "https:",
          sameSite: "lax",
          path: "/",
          maxAge: IP_VERDICT_TTL_S,
        },
      );
    }

    if (verdictError) {
      // Fail OPEN. A missing migration or a transient DB hiccup must not lock
      // the whole company out of a system whose only fix is inside the system.
      console.error("check_ip_access:", verdictError.message);
    } else if (verdict?.enforced && !verdict?.allowed) {
      // A 307 redirect on a POST replays the POST at /blocked, so non-GET
      // requests (server actions, API writes) get a plain 403 instead. The
      // user's next navigation lands them on the explanation page.
      if (request.method !== "GET" || request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            error:
              "This network is not approved for access. Contact your administrator.",
            code: "ip_blocked",
            ip,
          },
          { status: 403 },
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = "/blocked";
      url.search = ip ? `?ip=${encodeURIComponent(ip)}` : "";
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
