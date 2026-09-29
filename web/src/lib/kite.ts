import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";

/** Cookie holding the random value that must come back from Zerodha unchanged. */
export const STATE_COOKIE = "fx_kite_state";

export type KiteState = "never" | "connected" | "expired";
export type KiteStatus = { state: KiteState; kiteUserId?: string | null; connectedAt?: string; expiresAt?: string };

/**
 * Your Kite connection, read straight from Supabase (row-level security: only your own row, and
 * never the token itself). Cached per request so the masthead and the page share one query.
 */
export const kiteStatus = cache(async (userId: string): Promise<KiteStatus> => {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("kite_tokens")
    .select("kite_user_id, expires_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { state: "never" };
  const live = new Date(data.expires_at).getTime() > Date.now();
  return { state: live ? "connected" : "expired", kiteUserId: data.kite_user_id, connectedAt: data.updated_at, expiresAt: data.expires_at };
});

/** What each ?kite=… code on the Today page means, in plain words. */
export const KITE_NOTICES: Record<string, { tone: "error" | "neutral"; text: string }> = {
  cancelled: { tone: "neutral", text: "The Zerodha login was cancelled. Nothing changed." },
  login_expired: { tone: "error", text: "That Zerodha login had expired before it reached us. Connect again." },
  state: { tone: "error", text: "That Zerodha login didn't start from this browser, so it was ignored. Connect again from here." },
  kite_down: { tone: "error", text: "Kite isn't answering right now. Your saved data is unchanged; try again in a few minutes." },
  api_down: { tone: "error", text: "Couldn't reach the Fund X-Ray API. Try again in a moment." },
  not_configured: { tone: "error", text: "Kite isn't set up on the API yet (API key, secret or encryption key missing)." },
  disconnected: { tone: "neutral", text: "Zerodha disconnected. Your saved settings are unchanged." },
  error: { tone: "error", text: "Something went wrong connecting Zerodha. Try again." },
};
