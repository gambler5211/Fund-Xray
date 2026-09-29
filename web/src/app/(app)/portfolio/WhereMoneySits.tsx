import { pct, rupees } from "@/lib/format";
import type { SectorGroup } from "@/lib/sectorsShared";

/**
 * "Where the money sits": one bar per sector, split into its holdings. Bar length is the sector's
 * share of the whole portfolio (the longest sector sets the scale); each piece is one holding,
 * labelled when there's room and always on hover. The share sits at the end of each bar.
 */
export function WhereMoneySits({ groups, asOf }: { groups: SectorGroup[]; asOf: string }) {
  const max = Math.max(...groups.map((g) => g.share), 1);
  const unmapped = groups.find((g) => g.sector === "Unmapped");
  return (
    <figure className="flex flex-col gap-3">
      <ol className="flex flex-col" aria-label="Portfolio share by sector">
        {groups.map((g) => (
          <li key={g.sector} className="grid grid-cols-1 gap-1 border-b border-rule py-2.5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-center md:gap-5">
            <span className="flex items-baseline justify-between gap-3 md:block">
              <span className={`font-sans text-ui font-semibold ${g.sector === "Unmapped" ? "text-warn" : "text-ink"}`}>{g.sector}</span>
              <span className="font-sans text-caption text-ink-3 md:block">
                {g.holdings.length} {g.holdings.length === 1 ? "stock" : "stocks"} · {rupees(g.value)}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className="flex h-7 min-w-0 flex-1" aria-hidden>
                <span className="flex h-full gap-px" style={{ width: `${(g.share / max) * 100}%` }}>
                  {g.holdings.map((h, i) => {
                    const w = (h.share / g.share) * 100;
                    return (
                      <span
                        key={h.symbol}
                        title={`${h.name}: ${rupees(h.value)}, ${pct(h.share)} of portfolio`}
                        className={`flex h-full min-w-[2px] items-center overflow-hidden px-1 font-sans text-[11px] font-semibold whitespace-nowrap ${
                          g.sector === "Unmapped" ? "bg-warn text-on-fill" : i % 2 ? "bg-ink-3 text-paper" : "bg-ink-2 text-paper"
                        }`}
                        style={{ width: `${w}%` }}
                      >
                        {h.share >= 2.5 ? <span className="hidden md:inline">{h.symbol}</span> : null}
                      </span>
                    );
                  })}
                </span>
              </span>
              <span className="figures w-16 shrink-0 text-right text-[18px] font-medium">{g.shown === 0 && g.share > 0 ? "<0.1%" : pct(g.shown)}</span>
            </span>
            <span className="sr-only">
              {g.sector}: {pct(g.shown)} of your portfolio, in {g.holdings.map((h) => `${h.name} ${pct(h.share)}`).join(", ")}.
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="font-sans text-caption text-ink-3">
        Sectors: NSE Indices industry classification (sector level), with your own choices for stocks NSE hasn&apos;t classified
        {unmapped ? `; ${unmapped.holdings.length} still unmapped` : ""}. Values: Zerodha Kite, as of {asOf} IST. Shares add to 100%; hover a block to see its stock.
      </figcaption>
    </figure>
  );
}
