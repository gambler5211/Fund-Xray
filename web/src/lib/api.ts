import { supabaseServer } from "@/lib/supabase/server";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; code: string; message: string };

/**
 * Call the Python API from the server, as the signed-in user (their Supabase token goes in the
 * Authorization header; the API verifies it). Never throws: network failures come back as
 * { ok: false, code: "api_down" }.
 */
export async function apiServer<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, status: 401, code: "signed_out", message: "Sign in again." };
  try {
    const r = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    const body = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, status: r.status, data: body as T };
    const d = (body?.detail ?? {}) as { code?: string; message?: string };
    return { ok: false, status: r.status, code: d.code ?? `http_${r.status}`, message: d.message ?? "The API refused the request." };
  } catch {
    return { ok: false, status: 0, code: "api_down", message: "Couldn't reach the API." };
  }
}
