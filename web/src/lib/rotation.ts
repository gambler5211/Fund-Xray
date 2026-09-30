import { supabaseServer } from "@/lib/supabase/server";
import { latestSnapshot } from "@/lib/holdings";
import { sectorSplit, sectorsFor } from "@/lib/sectors";
import { TAIL_WEEKS, nearLine, toQuadrant, type BenchmarkKey, type HeldInfo, type IndexRow, type Point } from "@/lib/rotationShared";

export * from "@/lib/rotationShared";

type ScoreRow = { index_key: string; date: string; ratio: number | string; momentum: number | string; quadrant: string; settled_quadrant: string | null };

export type RotationData =
  | { state: "ok"; asOf: string; rows: IndexRow[]; unmappedShare: number | null; hasHoldings: boolean }
  | { state: "empty" }
  | { state: "error"; message: string };

const DAY = 24 * 60 * 60 * 1000;

/** Your money per tracked index, through sector_index_map (share of the whole portfolio, 0–100). */
async function heldByIndex(): Promise<{ held: Map<string, HeldInfo>; unmappedShare: number } | null> {
  const snap = await latestSnapshot();
  if (!snap || !snap.holdings.length) return null;
  const supabase = await supabaseServer();
  const [sectors, map] = await Promise.all([sectorsFor(snap.holdings), supabase.from("sector_index_map").select("industry, index_key, fit")]);
  const byIndustry = new Map((map.data ?? []).map((r: { industry: string; index_key: string; fit: string }) => [r.industry, r]));
  const held = new Map<string, HeldInfo>();
  let mapped = 0;
  for (const g of sectorSplit(snap.holdings, sectors)) {
    const m = byIndustry.get(g.sector);
    if (!m) continue;
    mapped += g.share;
    const cur = held.get(m.index_key) ?? { share: 0, sectors: [], proxy: false };
    held.set(m.index_key, { share: cur.share + g.share, sectors: [...cur.sectors, g.sector], proxy: cur.proxy || m.fit === "proxy" });
  }
  return { held, unmappedShare: Math.max(0, 100 - mapped) };
}

/** This week's point, 8-week tail and your money for every sector index against one benchmark. */
export async function loadRotation(benchmark: BenchmarkKey): Promise<RotationData> {
  const supabase = await supabaseServer();
  const [tracked, latest] = await Promise.all([
    supabase.from("tracked_indices").select("key, label, kind, sort").order("sort"),
    supabase.from("rotation_scores").select("date").eq("benchmark_key", benchmark).eq("week_end", true).order("date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (tracked.error || latest.error) return { state: "error", message: (tracked.error ?? latest.error)!.message };
  if (!latest.data) return { state: "empty" };
  const asOf = latest.data.date as string;

  // Tail + one extra week for "last week", with a few days' slack for holidays.
  const since = new Date(new Date(asOf).getTime() - (TAIL_WEEKS + 1) * 7 * DAY).toISOString().slice(0, 10);
  const [scores, money] = await Promise.all([
    supabase
      .from("rotation_scores")
      .select("index_key, date, ratio, momentum, quadrant, settled_quadrant")
      .eq("benchmark_key", benchmark)
      .eq("week_end", true)
      .gte("date", since)
      .order("date")
      .limit(1000),
    heldByIndex(),
  ]);
  if (scores.error) return { state: "error", message: scores.error.message };

  const byKey = new Map<string, Point[]>();
  for (const s of (scores.data ?? []) as ScoreRow[]) {
    const q = toQuadrant(s.settled_quadrant) ?? toQuadrant(s.quadrant);
    if (!q) continue;
    const list = byKey.get(s.index_key) ?? [];
    list.push({ date: s.date, ratio: Number(s.ratio), momentum: Number(s.momentum), quadrant: q });
    byKey.set(s.index_key, list);
  }

  const rows: IndexRow[] = [];
  for (const t of (tracked.data ?? []) as { key: string; label: string; kind: string }[]) {
    if (t.kind === "broad" || t.key === benchmark) continue;
    const pts = byKey.get(t.key);
    if (!pts?.length || pts[pts.length - 1].date !== asOf) continue; // no score this week (short history)
    const now = pts[pts.length - 1];
    rows.push({
      key: t.key,
      label: t.label,
      now,
      tail: pts.slice(-TAIL_WEEKS),
      prev: pts.length >= 2 ? pts[pts.length - 2] : null,
      fourWeeksAgo: pts.length >= 5 ? pts[pts.length - 5] : null,
      nearLine: nearLine(now.ratio, now.momentum),
      held: money?.held.get(t.key) ?? null,
    });
  }
  if (!rows.length) return { state: "empty" };
  return { state: "ok", asOf, rows, unmappedShare: money ? money.unmappedShare : null, hasHoldings: !!money };
}
