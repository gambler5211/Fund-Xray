/** Exit liquidity and size flags for holdings (Week 3, Day 3). Shared by server and client code. */

/** You'd sell no more than this share of a stock's normal daily volume, so your own selling doesn't move the price. */
export const PARTICIPATION = 0.1;
/** Flag a holding that would take longer than this to sell at that pace. */
export const SLOW_EXIT_DAYS = 5;
/** Trading days in the average volume. */
export const VOLUME_DAYS = 20;

export type Liquidity = { avgVolume: number | null; days: number | null; sessions: number };
export type LiquidityMap = Record<string, Liquidity>; // key "NSE:SYMBOL"

/** Days to sell = your quantity ÷ (10% of the 20-day average volume). */
export function daysToSell(quantity: number, avgVolume: number | null, participation = PARTICIPATION): number | null {
  if (!avgVolume || avgVolume <= 0 || quantity <= 0) return null;
  return quantity / (participation * avgVolume);
}

/** "under a day", "about 3 days", "about 12 days". */
export function daysText(days: number | null): string {
  if (days === null) return "no volume data";
  if (days < 1) return "under a day";
  const d = Math.round(days);
  return `about ${d} day${d === 1 ? "" : "s"}`;
}

/** The words for a holding's flags, or an empty list. */
export function holdingFlags(weightPct: number, days: number | null, stockLimit: number, slowDays = SLOW_EXIT_DAYS): string[] {
  const out: string[] = [];
  if (weightPct > stockLimit) out.push(`${Math.round(weightPct)}% of your money, above your ${stockLimit}% limit for one stock`);
  if (days !== null && days > slowDays) out.push(`${daysText(days)} to sell at ${PARTICIPATION * 100}% of its daily volume`);
  return out;
}
