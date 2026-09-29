import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";

/**
 * Google sends the visitor back here (via Supabase) with a one-time code.
 * Swap it for a session cookie, then continue to the page they wanted.
 * The users and settings rows are created by a database trigger on first sign-in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?error=cancelled`);
  }
  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=exchange`);

  return NextResponse.redirect(`${origin}${next}`);
}
