/** Supabase project address and publishable key. Both are safe to ship to the browser. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** False until both variables are set (web/.env.local locally, Vercel → Environment Variables in production). */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
