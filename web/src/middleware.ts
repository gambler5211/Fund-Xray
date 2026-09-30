import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/env";

/** Pages anyone may open. Everything else needs a signed-in user. */
const PUBLIC = ["/login", "/welcome", "/auth", "/ui"];
/** Pages a signed-in user has no reason to see; send them to Today instead. */
const SIGNED_OUT_ONLY = ["/login", "/welcome"];

const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  let response = NextResponse.next({ request });
  let signedIn = false;

  if (supabaseConfigured) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    });
    // Verifies the token and refreshes it when it is close to expiry. Must run before any redirect.
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  }

  const redirect = (to: string, keepNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    if (keepNext && path !== "/") url.searchParams.set("next", path + request.nextUrl.search);
    const r = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  // The site's front door is the welcome page; deep links go to sign-in and come back after.
  if (!signedIn && path === "/") return redirect("/welcome");
  if (!signedIn && !matches(path, PUBLIC)) return redirect("/login", true);
  if (signedIn && matches(path, SIGNED_OUT_ONLY)) return redirect("/");
  return response;
}

export const config = {
  // Skip Next's own files and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
