"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { INDUSTRIES, type SectorInfo } from "@/lib/sectorsShared";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * The sector cell. NSE's sector shows as plain text; your own choice shows with "(yours)"; a stock
 * NSE hasn't classified shows an ochre "Unmapped" note. Clicking either of the last two opens a
 * small picker that saves your choice (row-level security: only your own overrides).
 */
export function SectorPicker({ instrument, info, demo = false }: { instrument: string; info: SectorInfo; demo?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(info.industry ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  if (info.source === "nse") return <span className="font-sans text-ui text-ink-2">{info.industry}</span>;

  async function save(industry: string | null) {
    if (demo) return setOpen(false);
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    const res = industry
      ? await supabase.from("sector_overrides").upsert({ user_id: uid, instrument, industry, updated_at: new Date().toISOString() })
      : await supabase.from("sector_overrides").delete().eq("instrument", instrument);
    setBusy(false);
    if (res.error) return setError("Couldn't save. Try again.");
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={
          info.source === "you"
            ? "font-sans text-ui text-ink-2 underline decoration-dotted underline-offset-4"
            : "border border-warn px-1.5 py-px font-sans text-caption font-semibold uppercase tracking-[0.08em] text-warn"
        }
      >
        {info.source === "you" ? <>{info.industry} <span className="text-caption text-ink-3">(yours)</span></> : "Unmapped"}
      </button>
      {open ? (
        <div role="dialog" aria-label={`Sector for ${instrument}`} className="fixed inset-x-5 top-1/3 z-50 flex flex-col gap-2 border border-ink bg-paper p-4 text-left shadow-[6px_6px_0_var(--rule)] md:inset-x-auto md:left-1/2 md:w-96 md:-translate-x-1/2">
          <label className="font-sans text-caption text-ink-3" htmlFor={`sec-${instrument}`}>
            {info.source === "you" ? "Your sector for" : "NSE hasn’t classified"} <strong className="text-ink">{instrument.split(":")[1]}</strong>. Pick its sector:
          </label>
          <select id={`sec-${instrument}`} value={value} onChange={(e) => setValue(e.target.value)} className="h-10 border border-ink bg-paper px-2 font-sans text-ui text-ink">
            <option value="" disabled>
              Choose a sector
            </option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!value || busy} onClick={() => save(value)} className="h-9 bg-ink px-3 font-sans text-ui font-semibold text-paper disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
            {info.source === "you" ? (
              <button type="button" disabled={busy} onClick={() => save(null)} className="h-9 px-2 font-sans text-ui text-loss underline underline-offset-4">
                Remove my choice
              </button>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="font-sans text-caption text-loss">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
