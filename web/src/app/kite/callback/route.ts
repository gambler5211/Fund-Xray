import { NextResponse, type NextRequest } from "next/server";
import { apiServer } from "@/lib/api";
import { STATE_COOKIE } from "@/lib/kite";

const KNOWN = new Set(["login_expired", "kite_down", "api_down", "not_configured"]);

/**
 * Zerodha sends the browser here after login (this address is the Redirect URL on the Kite app):
 *   /kite/callback?action=login&type=login&status=success&request_token=…&state=…
 * We check the state cookie, hand the one-time request token to the API (which swaps it for an
 * access token using the secret and stores it encrypted), then show the return screen.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${origin}/?kite=${code}`);
    res.cookies.delete({ name: STATE_COOKIE, path: "/kite" });
    return res;
  };

  const requestToken = searchParams.get("request_token");
  if (searchParams.get("status") !== "success" || !requestToken) return fail("cancelled");

  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!expected || searchParams.get("state") !== expected) return fail("state");

  const r = await apiServer<{ kite_user_id?: string }>("/kite/session", {
    method: "POST",
    body: JSON.stringify({ request_token: requestToken }),
  });
  if (!r.ok) return fail(KNOWN.has(r.code) ? r.code : "error");

  const res = NextResponse.redirect(`${origin}/kite/connected${r.data.kite_user_id ? `?as=${encodeURIComponent(r.data.kite_user_id)}` : ""}`);
  res.cookies.delete({ name: STATE_COOKIE, path: "/kite" });
  return res;
}
