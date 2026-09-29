"use client";

import { useEffect } from "react";

/** A short confirmation at the bottom of the screen ("Saved"). Announced to screen readers. */
export function Toast({ message, onDone, tone = "neutral" }: { message: string | null; onDone: () => void; tone?: "neutral" | "error" }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, tone === "error" ? 6000 : 2500);
    return () => clearTimeout(t);
  }, [message, onDone, tone]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-5 md:bottom-8">
      {message ? (
        <div
          role={tone === "error" ? "alert" : "status"}
          className={`fade-in pointer-events-auto border px-4 py-2.5 font-sans text-ui font-semibold shadow-[4px_4px_0_var(--rule)] ${
            tone === "error" ? "border-loss bg-paper text-loss" : "border-ink bg-ink text-paper"
          }`}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
