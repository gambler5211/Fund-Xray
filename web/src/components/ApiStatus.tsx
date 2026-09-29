"use client";

import { useEffect, useState } from "react";

type State = "checking" | "ok" | "down";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Small dot in the footer: is the Python API reachable? */
export function ApiStatus() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    fetch(`${API_URL}/health`, { signal: ctrl.signal })
      .then((r) => setState(r.ok ? "ok" : "down"))
      .catch(() => setState("down"))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  const label = { checking: "Checking API…", ok: "API connected", down: "API offline" }[state];
  const dot = { checking: "bg-ink-3", ok: "bg-gain", down: "bg-loss" }[state];

  return (
    <span className="flex items-center gap-2" role="status">
      <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
