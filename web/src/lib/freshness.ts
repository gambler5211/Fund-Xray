import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { latestSnapshot } from "@/lib/holdings";

export type NightlyRun = { status: "ok" | "failed"; finishedAt: string; summary: string | null; latestDate: string | null; rotationDate: string | null };
export type Freshness = { kiteSyncedAt: string | null; nightly: NightlyRun | null };

/** How old the data on screen is: your last Kite pull and the last nightly market-data run. */
export const freshness = cache(async (): Promise<Freshness> => {
  const supabase = await supabaseServer();
  const [snap, run] = await Promise.all([
    latestSnapshot(),
    supabase.from("job_runs").select("status, finished_at, summary, details").eq("job", "nightly").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const r = run.data as { status: "ok" | "failed"; finished_at: string; summary: string | null; details: { latest_date?: string | null; rotation_latest?: string | null } | null } | null;
  return {
    kiteSyncedAt: snap?.taken_at ?? null,
    nightly: r ? { status: r.status, finishedAt: r.finished_at, summary: r.summary, latestDate: r.details?.latest_date ?? null, rotationDate: r.details?.rotation_latest ?? null } : null,
  };
});

const DAY = 24 * 60 * 60 * 1000;

/**
 * Is the nightly data late? It runs Monday to Friday evenings, so on a Monday morning the last
 * run is Friday's. More than 4 days old means runs have been missed.
 */
export function nightlyIsLate(run: NightlyRun, now = Date.now()) {
  return run.status === "failed" || now - new Date(run.finishedAt).getTime() > 4 * DAY;
}
