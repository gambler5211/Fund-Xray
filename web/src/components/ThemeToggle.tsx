"use client";

import { useEffect, useState } from "react";

type Theme = "day" | "night";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("day");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "night" ? "night" : "day");
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("fx-theme", next);
    } catch {
      // Storage can be blocked (private mode); the switch still works for this visit.
    }
  }

  return (
    <div role="group" aria-label="Theme" className="flex border border-ink font-sans text-caption">
      {(["day", "night"] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={theme === t}
          onClick={() => choose(t)}
          className={`h-8 px-3 capitalize transition-colors duration-150 ${
            theme === t ? "bg-ink font-semibold text-paper" : "text-ink hover:bg-paper-2"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
