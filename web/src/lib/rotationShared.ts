/** Rotation helpers shared by the server page and the client chart (no server-only imports). */
import type { Quadrant } from "@/lib/quadrant";

/** Settings stores the benchmark by NSE name; rotation_scores by key. */
export const BENCHMARK_KEYS = {
  "NIFTY 50": "nifty-50",
  "NIFTY 500": "nifty-500",
  "NIFTY MIDCAP 150": "nifty-midcap-150",
  "NIFTY SMALLCAP 250": "nifty-smallcap-250",
} as const;
export type BenchmarkKey = (typeof BENCHMARK_KEYS)[keyof typeof BENCHMARK_KEYS];
export const BENCHMARK_LABELS: Record<BenchmarkKey, string> = {
  "nifty-50": "Nifty 50",
  "nifty-500": "Nifty 500",
  "nifty-midcap-150": "Midcap 150",
  "nifty-smallcap-250": "Smallcap 250",
};
export const isBenchmarkKey = (v: unknown): v is BenchmarkKey => typeof v === "string" && v in BENCHMARK_LABELS;

/** Same as the engine's rotation.NEUTRAL_BAND: within this of 100 the reading can't tell quadrants apart. */
export const NEUTRAL_BAND = 0.5;
export const TAIL_WEEKS = 8;

/** Clockwise from top right, the way a sector usually travels. */
export const CLOCKWISE: Quadrant[] = ["leading", "weakening", "lagging", "improving"];

export type Point = { date: string; ratio: number; momentum: number; quadrant: Quadrant };

export type HeldInfo = { share: number; sectors: string[]; proxy: boolean };

export type IndexRow = {
  key: string;
  label: string;
  now: Point;
  tail: Point[]; // oldest first, ends at now
  prev: Point | null; // last week
  fourWeeksAgo: Point | null;
  nearLine: boolean;
  held: HeldInfo | null;
};

export const nearLine = (ratio: number, momentum: number) => Math.abs(ratio - 100) < NEUTRAL_BAND || Math.abs(momentum - 100) < NEUTRAL_BAND;

export const toQuadrant = (s: string | null | undefined): Quadrant | null =>
  s === "Leading" ? "leading" : s === "Weakening" ? "weakening" : s === "Lagging" ? "lagging" : s === "Improving" ? "improving" : null;

const QNAME: Record<Quadrant, string> = { leading: "Leading", weakening: "Weakening", lagging: "Lagging", improving: "Improving" };

/** "Metal", "Metal and Pharma", "Metal, Pharma and 2 more". */
export function nameList(names: string[], max = 2) {
  if (names.length <= max) return names.length === 2 ? `${names[0]} and ${names[1]}` : names.join("");
  const shown = names.slice(0, max);
  const more = names.length - max;
  return `${shown.join(", ")} and ${more} more`;
}

const pctText = (n: number) => `${n >= 9.95 ? Math.round(n) : n.toFixed(1)}%`;

/** Sectors whose steady label changed since last week, grouped by where they arrived. */
export function moves(rows: IndexRow[]) {
  const moved = rows.filter((r) => r.prev && r.prev.quadrant !== r.now.quadrant);
  const by = (q: Quadrant) =>
    moved
      .filter((r) => r.now.quadrant === q)
      .sort((a, b) => (b.held?.share ?? 0) - (a.held?.share ?? 0) || Math.abs(b.now.ratio - 100) - Math.abs(a.now.ratio - 100));
  return { moved, into: Object.fromEntries(CLOCKWISE.map((q) => [q, by(q)])) as Record<Quadrant, IndexRow[]> };
}

/**
 * The page lead, e.g. "Metal and PSU Bank moved into Leading this week; 14% of your money is in Metal".
 * Descriptive only: where sectors are, never what to do about it.
 */
export function rotationHeadline(rows: IndexRow[]): string {
  const { moved, into } = moves(rows);
  let first: string;
  let named: IndexRow[] = [];
  if (into.leading.length) {
    named = into.leading;
    first = `${nameList(named.map((r) => r.label))} moved into Leading this week`;
  } else if (moved.length) {
    const q = CLOCKWISE.find((x) => into[x].length)!;
    named = into[q];
    first = `${nameList(named.map((r) => r.label))} moved into ${QNAME[q]} this week`;
  } else {
    const top = rows.filter((r) => r.now.quadrant === "leading").sort((a, b) => b.now.ratio - a.now.ratio)[0];
    named = top ? [top] : [];
    first = top ? `No sector changed quadrant this week; ${top.label} leads` : "No sector changed quadrant this week";
  }
  const heldNamed = named.filter((r) => r.held).slice(0, 2);
  if (!heldNamed.length) return first;
  const share = heldNamed.reduce((s, r) => s + r.held!.share, 0);
  return `${first}; ${pctText(share)} of your money is in ${nameList(heldNamed.map((r) => r.label))}`;
}

/** Your money by the steady quadrant of the sector it sits in (mapped sectors only). */
export function moneyByQuadrant(rows: IndexRow[]) {
  const out: Record<Quadrant, number> = { leading: 0, weakening: 0, lagging: 0, improving: 0 };
  for (const r of rows) if (r.held) out[r.now.quadrant] += r.held.share;
  return out;
}

/** The sentence under the lead. */
export function rotationDek(rows: IndexRow[], benchmark: string, unmappedShare: number | null): string {
  const intro = `Each dot is a sector index measured against the ${benchmark}: right of the centre line it's ahead, above it it's gaining pace.`;
  if (unmappedShare === null) return intro;
  const m = moneyByQuadrant(rows);
  const parts = CLOCKWISE.filter((q) => m[q] >= 0.05).map((q) => `${pctText(m[q])} in ${QNAME[q]}`);
  if (!parts.length) return `${intro} None of your holdings sit in a tracked sector.`;
  const rest = unmappedShare >= 0.05 ? ` The other ${pctText(unmappedShare)} is in sectors without an index, funds, or unmapped.` : "";
  return `${intro} Of your money, ${parts.join(", ")}.${rest}`;
}
