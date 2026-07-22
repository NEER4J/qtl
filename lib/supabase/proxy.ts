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

  if (
    request.nextUrl.pathname !== "/" &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
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

    // One round trip: the DB decides, because the allowlist and the master
    // switch aren't readable by ordinary roles. `check_ip_access` also handles
    // the Admin bypass and the "enabled but no rules yet" escape hatch.
    const { data: verdict, error: verdictError } = await supabase.rpc(
      "check_ip_access",
      { p_ip: ip ?? "" },
    );

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
