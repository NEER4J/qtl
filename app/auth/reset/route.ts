import { NextResponse, type NextRequest } from "next/server";

// "Trouble signing in? Reset" — expires every cookie the browser sent for this
// site, httpOnly ones included (the IP-lock verdict, Supabase's session
// chunks), which JavaScript on the page can't touch. Excluded from the
// middleware matcher so a broken session can't stop it from running.
export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Cache-Control", "no-store");
  for (const { name } of request.cookies.getAll()) {
    res.cookies.set(name, "", { path: "/", maxAge: 0, expires: new Date(0) });
  }
  return res;
}
