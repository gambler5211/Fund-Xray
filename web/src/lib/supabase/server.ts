import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "./env";

/** Supabase client for server components, route handlers and server actions. Create one per request. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server components can't set cookies; the middleware refreshes the session instead.
        }
      },
    },
  });
}

export type SignedInUser = { id: string; email: string; name: string | null; avatar: string | null };

/**
 * The signed-in user, from a verified token (getClaims checks the signature against Supabase's
 * public keys), or null when signed out.
 */
export async function currentUser(): Promise<SignedInUser | null> {
  if (!supabaseConfigured) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  const meta = (c.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return {
    id: c.sub,
    email: str(c.email) ?? "",
    name: str(meta.full_name) ?? str(meta.name),
    avatar: str(meta.avatar_url),
  };
}
