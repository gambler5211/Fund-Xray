"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Account menu in the date line.
 * Day 2: the shell only. Day 3 fills in the signed-in name and a working Sign out.
 */
export function AccountMenu({ name }: { name?: string }) {
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

  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center border border-ink font-sans text-caption font-semibold text-ink hover:bg-paper-2"
      >
        {initial}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-9 z-30 flex w-52 flex-col border border-ink bg-paper py-1 shadow-[4px_4px_0_var(--rule)]">
          <span className="px-3 py-2 font-sans text-caption text-ink-3">{name ? `Signed in as ${name}` : "Not signed in yet"}</span>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="px-3 py-2 font-sans text-ui text-ink no-underline hover:bg-paper-2">
            Settings
          </Link>
          <button role="menuitem" type="button" disabled className="cursor-not-allowed px-3 py-2 text-left font-sans text-ui text-ink-3">
            Sign out <span className="text-caption">(after sign-in, Day 3)</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
