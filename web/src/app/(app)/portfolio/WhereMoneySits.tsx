import { pct, rupees } from "@/lib/format";
import type { SectorGroup } from "@/lib/sectorsShared";
import { PickSectorsButton } from "./PickSectorsButton";

const TOP_NAMES = 3;

/** The sentence above the chart: the lead sector, the top two together, and what's unclassified. */
function headline(mapped: SectorGroup[], unmapped?: SectorGroup) {
  if (!mapped.length) return "None of your holdings has a sector yet";
  const [a, b] = mapped;
  const lead = b
    ? `${a.sector} and ${b.sector} hold ${pct(a.shown + b.shown, 0)} of your money`
    : `${a.sector} holds ${pct(a.shown, 0)} of your money`;
  return unmapped && unmapped.shown >= 5 ? `${lead}; ${pct(unmapped.shown, 0)} isn't classified yet` : lead;
}

/**
 * "Where the money sits": sectors ranked by the share of your portfolio they hold. One thin bar per
 * sector with its share right at the bar's end, and the biggest holdings named underneath in words
 * (readable, unlike slivers). Unclassified money sits apart, as an outline, with the fix next to it.
 * The holdings table below is the full, sortable view of the same numbers.
 */
export function WhereMoneySits({ groups, asOf }: { groups: SectorGroup[]; asOf: string }) {
  const mapped = groups.filter((g) => g.sector !== "Unmapped");
  const unmapped = groups.find((g) => g.sector === "Unmapped");
  const max = Math.max(...groups.map((g) => g.share), 1);

  return (
    <figure className="flex flex-col gap-4">
      <p className="max-w-[60ch] text-lead leading-snug text-ink">{headline(mapped, unmapped)}.</p>

      <ol className="flex flex-col" aria-label="Share of your portfolio by sector">
        {mapped.map((g, i) => (
          <Row key={g.sector} g={g} max={max} strong={i < 2} />
        ))}
      </ol>

      {unmapped ? (
        <div className="flex flex-col gap-3 border-t-2 border-ink pt-3">
          <Row g={unmapped} max={max} unmapped />
          <div className="flex flex-wrap items-center gap-3">
            <PickSectorsButton count={unmapped.holdings.length} />
            <span className="font-sans text-caption text-ink-3">NSE doesn&apos;t classify these; choose once and it sticks.</span>
          </div>
        </div>
      ) : null}

      <figcaption className="font-sans text-caption text-ink-3">
        Sectors: NSE Indices industry classification (sector level); ETFs grouped as “ETFs &amp; funds”; your own choices where NSE has none.
        Values: Zerodha Kite, as of {asOf} IST. Shares add to 100%.
      </figcaption>
    </figure>
  );
}

function Row({ g, max, strong = false, unmapped = false }: { g: SectorGroup; max: number; strong?: boolean; unmapped?: boolean }) {
  const top = g.holdings.slice(0, TOP_NAMES);
  const more = g.holdings.length - top.length;
  const share = g.shown === 0 && g.share > 0 ? "<0.1%" : pct(g.shown);
  return (
    <li className="grid grid-cols-1 gap-1.5 border-b border-rule py-3 last:border-b-0 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-6" title={`${g.sector}: ${rupees(g.value)}, ${share} of your portfolio`}>
      <div className="flex items-baseline justify-between gap-3 md:flex-col md:items-start md:gap-0.5">
        <span className={`font-sans text-ui font-semibold ${unmapped ? "text-warn" : "text-ink"}`}>{unmapped ? "Not classified" : g.sector}</span>
        <span className="font-sans text-caption text-ink-3">
          {g.holdings.length} {g.holdings.length === 1 ? "stock" : "stocks"} · {rupees(g.value)}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={`h-3 shrink-0 ${unmapped ? "border-2 border-warn" : strong ? "bg-ink" : "bg-ink-3"}`}
            style={{ width: `calc(${(g.share / max) * 100}% - 4.5rem)`, minWidth: "3px" }}
          />
          <span className="figures shrink-0 text-[20px] leading-none font-medium text-ink">{share}</span>
        </div>
        <p className="truncate font-sans text-caption text-ink-2">
          {top.map((h, i) => (
            <span key={h.symbol}>
              {i ? " · " : ""}
              {h.name} <span className="figures text-ink-3">{h.share < 0.05 ? "<0.1%" : pct(h.share)}</span>
            </span>
          ))}
          {more > 0 ? <span className="text-ink-3"> · +{more} more</span> : null}
        </p>
      </div>
    </li>
  );
}
