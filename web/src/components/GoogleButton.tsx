"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/env";

/**
 * "Continue with Google". Sends the visitor to Google via Supabase; Google sends them back to
 * /auth/callback, which sets the session cookie and continues to `next`.
 */
export function GoogleButton({ full = false, next = "/" }: { full?: boolean; next?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!supabaseConfigured) {
      setError("Sign-in isn't set up on this copy of the site yet.");
      return;
    }
    setBusy(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    // On success the browser is already leaving for Google.
    if (error) {
      setBusy(false);
      setError("Couldn't reach Google. Try again in a moment.");
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${full ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        aria-busy={busy}
        className={`flex h-13 items-center justify-center gap-3 bg-ink px-6 font-sans text-body font-semibold text-paper transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70 ${
          full ? "w-full" : ""
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="fill-paper">
          <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
          <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" opacity="0.8" />
          <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" opacity="0.65" />
          <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" opacity="0.9" />
        </svg>
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {error ? (
        <p role="alert" className="font-sans text-ui text-loss">
          {error}
        </p>
      ) : null}
    </div>
  );
}
