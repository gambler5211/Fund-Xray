"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Account menu in the date line: who you're signed in as, Settings, Sign out. */
export function AccountMenu({ name, email }: { name?: string | null; email?: string | null }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const label = name || email || "";
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  const signedIn = Boolean(email);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={signedIn ? `Account menu for ${label}` : "Account menu"}
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center border border-ink font-sans text-caption font-semibold text-ink hover:bg-paper-2"
      >
        {initial}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-9 z-30 flex w-60 flex-col border border-ink bg-paper py-1 shadow-[4px_4px_0_var(--rule)]">
          <div className="flex flex-col gap-0.5 border-b border-rule px-3 pt-2 pb-3">
            {signedIn ? (
              <>
                {name ? <span className="font-sans text-ui font-semibold text-ink">{name}</span> : null}
                <span className="truncate font-sans text-caption text-ink-3">{email}</span>
              </>
            ) : (
              <span className="font-sans text-caption text-ink-3">Not signed in</span>
            )}
          </div>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="px-3 py-2 font-sans text-ui text-ink no-underline hover:bg-paper-2">
            Settings
          </Link>
          {signedIn ? (
            <form action="/auth/signout" method="post">
              <button role="menuitem" type="submit" className="w-full px-3 py-2 text-left font-sans text-ui text-ink hover:bg-paper-2">
                Sign out
              </button>
            </form>
          ) : (
            <Link role="menuitem" href="/login" onClick={() => setOpen(false)} className="px-3 py-2 font-sans text-ui text-ink no-underline hover:bg-paper-2">
              Sign in
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
