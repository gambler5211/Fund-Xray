import { NextResponse, type NextRequest } from "next/server";
import { apiServer } from "@/lib/api";
import { STATE_COOKIE } from "@/lib/kite";

/**
 * "Connect Zerodha": remember a random value in a short-lived cookie, ask the API for Zerodha's
 * login URL carrying that value, and send the browser there. /kite/callback checks the value comes
 * back unchanged, so a login link started by someone else can't attach their account to yours.
 */
export async function GET(request: NextRequest) {
  // Never start a login for a prefetch: it would replace the state cookie behind your back.
  const h = request.headers;
  if (h.get("next-router-prefetch") || h.get("purpose") === "prefetch" || h.get("sec-purpose")?.includes("prefetch")) {
    return new NextResponse(null, { status: 204 });
  }
  const origin = request.nextUrl.origin;
  const state = crypto.randomUUID().replace(/-/g, "");
  const r = await apiServer<{ url: string }>(`/kite/login-url?state=${state}`);
  if (!r.ok) return NextResponse.redirect(`${origin}/?kite=${r.code === "not_configured" ? "not_configured" : "api_down"}`);

  const res = NextResponse.redirect(r.data.url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax", // sent on Zerodha's top-level redirect back to us
    path: "/kite",
    maxAge: 600,
  });
  return res;
}
