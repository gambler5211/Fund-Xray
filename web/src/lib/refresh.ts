"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type RefreshResult = { ok: true } | { ok: false; code: string };

/** Ask the API to pull holdings from Kite now and save a snapshot. */
export async function refreshHoldings(): Promise<RefreshResult> {
  const { data } = await supabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, code: "signed_out" };
  try {
    const r = await fetch(`${API_URL}/holdings/refresh`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) return { ok: true };
    const body = await r.json().catch(() => ({}));
    return { ok: false, code: body?.detail?.code ?? `http_${r.status}` };
  } catch {
    return { ok: false, code: "api_down" };
  }
}

/** Plain words for each refresh failure. */
export const REFRESH_ERRORS: Record<string, string> = {
  kite_expired: "Your Zerodha connection has ended. Reconnect to refresh.",
  kite_not_connected: "Connect Zerodha first.",
  kite_down: "Kite isn't answering right now. Your last numbers are still shown.",
  api_down: "Couldn't reach the Fund X-Ray API. Try again in a moment.",
  database_down: "Couldn't save the new numbers. Try again in a moment.",
  signed_out: "You're signed out. Sign in again.",
};
