import Link from "next/link";
import { rupees } from "@/lib/format";
import type { Plan } from "@/lib/indicatorsShared";

const pctText = (n: number) => `${n >= 9.95 ? Math.round(n) : n.toFixed(1)}%`;
const months = (n: number) => `${n} month${n === 1 ? "" : "s"}`;

/** Index share against your own target band, and what your next monthly amount would do to it. */
export function Planner({ p, indexValue, monthly, funds }: { p: Plan; indexValue: number; monthly: number | null; funds: string[] }) {
  const band = `${p.low}–${p.high}%`;
  let lead: string;
  let body: string;
  if (p.state === "inside") {
    lead = `Index funds are ${pctText(p.indexShare)} of your money, inside your ${band} target`;
    body = "Nothing needs changing to stay in your band.";
  } else if (p.state === "below") {
    lead = `Index funds are ${pctText(p.indexShare)} of your money, below your ${band} target`;
    body =
      `Reaching ${p.low}% takes about ${rupees(Math.ceil(p.gap))} more in index funds. ` +
      (p.nextToIndex !== null && p.months !== null
        ? p.months <= 1
          ? `Putting ${rupees(Math.ceil(p.nextToIndex))} of next month's ${rupees(monthly!)} into index funds would get you there.`
          : `Putting all of next month's ${rupees(monthly!)} into index funds moves you towards it; at that pace it takes about ${months(p.months)}.`
        : "Add your monthly amount in Settings to see how many months that takes.");
  } else {
    lead = `Index funds are ${pctText(p.indexShare)} of your money, above your ${band} target`;
    body =
      `Getting back to ${p.high}% without selling takes about ${rupees(Math.ceil(p.gap))} of new money outside index funds. ` +
      (p.nextElsewhere !== null && p.months !== null
        ? p.months <= 1
          ? `${rupees(Math.ceil(p.nextElsewhere))} of next month's ${rupees(monthly!)} outside index funds would do it.`
          : `Next month's ${rupees(monthly!)} all outside index funds moves you towards it; at that pace it takes about ${months(p.months)}.`
        : "Add your monthly amount in Settings to see how many months that takes.");
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[22px] font-medium leading-tight md:text-[26px]">{lead}</p>
      <p className="max-w-[70ch] text-body leading-relaxed text-ink-2">{body}</p>
      <p className="font-sans text-caption text-ink-3">
        {funds.length ? `Counted as index funds: ${funds.join(", ")} (${rupees(Math.round(indexValue))}). ` : "No index funds or ETFs found in your holdings. "}
        Gold, silver and liquid ETFs aren&apos;t counted. Mutual funds held outside your Zerodha demat aren&apos;t included. Your band and monthly amount
        are in <Link href="/settings">Settings</Link>. This follows your own target; it isn&apos;t advice.
      </p>
    </div>
  );
}
