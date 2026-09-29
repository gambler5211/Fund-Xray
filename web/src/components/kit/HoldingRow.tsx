import type { Quadrant } from "@/lib/quadrant";
import { Change, Rupees, Share } from "./Figures";
import { QuadrantChip } from "./QuadrantChip";

export type Holding = {
  name: string;
  sector: string;
  quadrant: Quadrant;
  value: number; // current value, ₹
  dayChangePct: number;
  weight: number; // % of portfolio
};

/** Column titles for the desktop table. Hidden on phones, where each row stacks. */
export function HoldingsHeader() {
  return (
    <div
      aria-hidden
      className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.7fr)] gap-4 border-b-2 border-ink pb-1.5 font-sans text-caption font-semibold text-ink-3 md:grid"
    >
      <span>Stock</span>
      <span>Sector strength</span>
      <span className="text-right">Value</span>
      <span className="text-right">Today</span>
      <span className="text-right">Share</span>
    </div>
  );
}

/** One holding. Two lines on a phone, one line on desktop. Put rows inside a <ul>. */
export function HoldingRow({ h }: { h: Holding }) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-b border-rule py-3 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.7fr)]">
      <div className="min-w-0">
        <div className="truncate text-body font-semibold">{h.name}</div>
        <div className="truncate font-sans text-caption text-ink-3">{h.sector}</div>
      </div>
      <div className="col-start-1 row-start-2 md:col-start-auto md:row-start-auto">
        <QuadrantChip quadrant={h.quadrant} />
      </div>
      <Rupees value={h.value} className="col-start-2 row-start-1 text-right text-body md:col-start-auto md:row-start-auto" />
      <Change value={h.dayChangePct} className="col-start-2 row-start-2 text-right font-sans text-ui md:col-start-auto md:row-start-auto" />
      <Share value={h.weight} className="hidden text-right font-sans text-ui text-ink-2 md:block" />
    </li>
  );
}
