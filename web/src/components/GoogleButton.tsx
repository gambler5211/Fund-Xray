import Link from "next/link";

/**
 * "Continue with Google".
 * Day 1: links into the app so the flow can be clicked through.
 * Day 3: becomes a client component calling supabase.auth.signInWithOAuth({ provider: "google" }).
 */
export function GoogleButton({ full = false }: { full?: boolean }) {
  return (
    <Link
      href="/"
      className={`flex h-13 items-center justify-center gap-3 bg-ink px-6 font-sans text-body font-semibold text-paper no-underline transition-opacity duration-150 hover:text-paper hover:opacity-90 ${
        full ? "w-full" : ""
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="fill-paper">
        <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
        <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" opacity="0.8" />
        <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" opacity="0.65" />
        <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" opacity="0.9" />
      </svg>
      Continue with Google
    </Link>
  );
}
