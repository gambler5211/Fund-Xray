import { supabaseServer } from "@/lib/supabase/server";
import { latestSnapshot } from "@/lib/holdings";
import { sectorSplit, sectorsFor } from "@/lib/sectors";
import { fromRow } from "@/lib/settings";
import {
  BENCHMARK_KEYS,
  TAIL_WEEKS,
  nearLine,
  toQuadrant,
  type BenchmarkKey,
  type BreadthInfo,
  type HeldInfo,
  type IndexRow,
  type Point,
  type RegimeInfo,
  type RegimeLabel,
} from "@/lib/rotationShared";

export * from "@/lib/rotationShared";

type ScoreRow = { index_key: string; date: string; ratio: number | string; momentum: number | string; quadrant: string; settled_quadrant: string | null };

export type RotationData =
  | { state: "ok"; asOf: string; rows: IndexRow[]; unmappedShare: number | null; hasHoldings: boolean; regime: RegimeInfo | null }
  | { state: "empty" }
  | { state: "error"; message: string };

const DAY = 24 * 60 * 60 * 1000;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** The benchmark you chose in Settings, as a rotation key. */
export async function userBenchmark(userId: string): Promise<BenchmarkKey> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("settings").select("benchmark").eq("user_id", userId).maybeSingle();
  return BENCHMARK_KEYS[fromRow((data ?? {}) as Record<string, unknown>).benchmark];
}

/** This week's regime, and how many weeks in a row it has held (market_regime, newest first). */
async function loadRegime(): Promise<RegimeInfo | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("market_regime").select("*").order("week_start", { ascending: false }).limit(12);
  const rows = (data ?? []) as Record<string, unknown>[];
  if (!rows.length) return null;
  const now = rows[0];
  let weeks = 0;
  while (weeks < rows.length && rows[weeks].regime === now.regime) weeks++;
  return {
    date: String(now.date),
    regime: now.regime as RegimeLabel,
    cyclical: Number(now.cyclical),
    defensive: Number(now.defensive),
    spread: Number(now.spread),
    marketBreadth: num(now.market_breadth),
    threshold: Number(now.threshold),
    breadthMin: Number(now.breadth_min),
    weeks,
    prev: weeks < rows.length ? (rows[weeks].regime as RegimeLabel) : null,
  };
}

/** Breadth for every index in the week that contains `asOf`. */
async function loadBreadth(asOf: string): Promise<Map<string, BreadthInfo>> {
  const d = new Date(asOf + "T00:00:00Z");
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
  const supabase = await supabaseServer();
  const { data } = await supabase.from("index_breadth").select("*").eq("week_start", monday);
  return new Map(
    ((data ?? []) as Record<string, unknown>[]).map((r) => [
      String(r.index_key),
      {
        members: Number(r.members),
        pctAbove: Number(r.pct_above_avg),
        pctUp: Number(r.pct_up),
        ewReturn: Number(r.ew_return),
        indexReturn: num(r.index_return),
        spread: num(r.spread),
        narrow: Boolean(r.narrow),
      },
    ]),
  );
}

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
    const cur = held.get(m.index_key) ?? { share: 0, sectors: [], proxy: false, holdings: [] };
    held.set(m.index_key, {
      share: cur.share + g.share,
      sectors: [...cur.sectors, g.sector],
      proxy: cur.proxy || m.fit === "proxy",
      holdings: [...cur.holdings, ...g.holdings.map((h) => ({ symbol: h.symbol, name: h.name, share: h.share }))].sort((a, b) => b.share - a.share),
    });
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
  const [scores, money, breadth, regime] = await Promise.all([
    supabase
      .from("rotation_scores")
      .select("index_key, date, ratio, momentum, quadrant, settled_quadrant")
      .eq("benchmark_key", benchmark)
      .eq("week_end", true)
      .gte("date", since)
      .order("date")
      .limit(1000),
    heldByIndex(),
    loadBreadth(asOf),
    loadRegime(),
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
      breadth: breadth.get(t.key) ?? null,
    });
  }
  if (!rows.length) return { state: "empty" };
  return { state: "ok", asOf, rows, unmappedShare: money ? money.unmappedShare : null, hasHoldings: !!money, regime };
}
