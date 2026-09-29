"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Toast } from "@/components/kit/Toast";
import { REFRESH_ERRORS, refreshHoldings } from "@/lib/refresh";

/**
 * Refresh in the date line: pulls fresh holdings and prices from Kite, then redraws the page.
 * Disabled (with the reason as its tooltip) until Kite is connected.
 */
export function RefreshButton({ kiteConnected = false }: { kiteConnected?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "neutral" | "error" } | null>(null);
  const done = useCallback(() => setToast(null), []);

  async function run() {
    setBusy(true);
    const r = await refreshHoldings();
    setBusy(false);
    if (r.ok) {
      setToast({ msg: "Holdings updated", tone: "neutral" });
      router.refresh();
    } else {
      setToast({ msg: REFRESH_ERRORS[r.code] ?? "Couldn't refresh. Try again.", tone: "error" });
      if (r.code === "kite_expired") router.refresh(); // the pill switches to Reconnect
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={!kiteConnected || busy}
        aria-busy={busy}
        title={kiteConnected ? "Fetch fresh holdings and prices from Kite" : "Connect Kite first"}
        className="hidden items-center gap-1 font-sans text-caption text-ink-3 enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex md:text-[13px]"
      >
        <span aria-hidden className={busy ? "inline-block animate-spin" : ""}>↻</span> {busy ? "Refreshing…" : "Refresh"}
      </button>
      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDone={done} />
    </>
  );
}
