/** Sector helpers shared by server and client components (no server-only imports here). */
import type { HoldingRowData } from "@/lib/holdings";

/** NSE's sector level of its industry classification (same list as the database check). */
export const INDUSTRIES = [
  "Automobile and Auto Components", "Capital Goods", "Chemicals", "Construction", "Construction Materials",
  "Consumer Durables", "Consumer Services", "Diversified", "Fast Moving Consumer Goods", "Financial Services",
  "Forest Materials", "Healthcare", "Information Technology", "Media Entertainment & Publication",
  "Metals & Mining", "Oil Gas & Consumable Fuels", "Power", "Realty", "Services", "Telecommunication",
  "Textiles", "Utilities",
] as const;

export type SectorInfo = { industry: string | null; source: "nse" | "you" | null };
export type SectorMap = Record<string, SectorInfo>; // key "NSE:SYMBOL"

export const instrumentKey = (h: { exchange: string; symbol: string }) => `${h.exchange}:${h.symbol}`;

export type SectorGroup = { sector: string; value: number; share: number; shown: number; holdings: { symbol: string; name: string; value: number; share: number }[] };

/**
 * Round shares to one decimal so the printed figures still add to exactly 100.0 (largest
 * remainder: round everything down, then give the leftover tenths to the biggest remainders).
 */
export function roundTo100(shares: number[]): number[] {
  const tenths = shares.map((x) => x * 10);
  const floors = tenths.map(Math.floor);
  let left = Math.round(tenths.reduce((a, b) => a + b, 0)) - floors.reduce((a, b) => a + b, 0);
  const order = tenths.map((t, i) => [t - floors[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors.map((f) => f / 10);
}

/** Holdings grouped by sector, biggest first, "Unmapped" last. Printed shares add to 100. */
export function sectorSplit(holdings: HoldingRowData[], sectors: SectorMap): SectorGroup[] {
  const total = holdings.reduce((s, h) => s + h.value, 0);
  const groups = new Map<string, HoldingRowData[]>();
  for (const h of holdings) {
    const k = sectors[instrumentKey(h)]?.industry ?? "Unmapped";
    groups.set(k, [...(groups.get(k) ?? []), h]);
  }
  return [...groups.entries()]
    .map(([sector, items]) => {
      const value = items.reduce((s, h) => s + h.value, 0);
      return {
        sector,
        value,
        share: total ? (value / total) * 100 : 0,
        shown: 0,
        holdings: [...items].sort((a, b) => b.value - a.value).map((h) => ({ symbol: h.symbol, name: h.name, value: h.value, share: total ? (h.value / total) * 100 : 0 })),
      };
    })
    .sort((a, b) => Number(a.sector === "Unmapped") - Number(b.sector === "Unmapped") || b.value - a.value)
    .map((g, i, all) => ({ ...g, shown: roundTo100(all.map((x) => x.share))[i] }));
}
