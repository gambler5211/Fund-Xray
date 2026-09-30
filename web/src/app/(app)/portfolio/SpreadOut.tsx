import type { Concentration } from "@/lib/concentration";
import { spreadDek, spreadHeadline } from "@/lib/concentration";
import { istTime } from "@/lib/format";

const share = (n: number) => `${n >= 9.95 ? Math.round(n) : n.toFixed(1)}%`;

/** "How spread out you are": effective bets and the clusters of holdings that move together. */
export function SpreadOut({ c, snapshotAt }: { c: Concentration | null; snapshotAt: string }) {
  if (!c) {
    return (
      <p className="max-w-[64ch] text-body leading-relaxed text-ink-2">
        This is worked out overnight from a year of weekly prices. It appears after tonight&apos;s market-data run.
      </p>
    );
  }
  const groups = c.clusters.filter((g) => g.symbols.length > 1);
  const alone = c.clusters.filter((g) => g.symbols.length === 1);
  const behind = new Date(snapshotAt).getTime() - new Date(c.snapshotAt).getTime() > 60 * 1000;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-[24px] font-medium leading-tight md:text-[28px]">{spreadHeadline(c)}</p>
        <p className="max-w-[70ch] text-body leading-relaxed text-ink-2">{spreadDek(c)}</p>
      </div>

      {groups.length ? (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <li key={g.symbols.join(",")} className="flex flex-col gap-2 border border-ink p-4">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-sans text-caption font-semibold uppercase tracking-[0.12em] text-ink-3">
                  One bet · {g.symbols.length} holdings
                </span>
                <span className="figures font-semibold">{share(g.share)}</span>
              </span>
              <span className="text-body leading-snug">{g.names.join(", ")}</span>
              {g.correlation !== null ? (
                <span className="figures font-sans text-caption text-ink-3">Moved together: average correlation {g.correlation.toFixed(2)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-ink-2">No two of your holdings moved closely together over the last year.</p>
      )}

      {alone.length ? (
        <p className="max-w-[70ch] text-body leading-relaxed text-ink-2">
          {groups.length ? "The other " : ""}
          {alone.length} {alone.length === 1 ? "holding moves" : "holdings move"} mostly on {alone.length === 1 ? "its" : "their"} own:{" "}
          {alone.map((g) => `${g.names[0]} (${share(g.share)})`).join(", ")}.
        </p>
      ) : null}
      {c.leftOut.length ? (
        <p className="max-w-[70ch] font-sans text-ui text-ink-3">
          Not grouped, under 6 months of prices (each counted as a bet of its own): {c.leftOut.map((x) => x.name).join(", ")}.
        </p>
      ) : null}
      <p className="font-sans text-caption text-ink-3">
        From weekly NSE closes to {c.pricesTo ? new Date(c.pricesTo).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "–"}, adjusted for
        splits. {behind ? `Uses your holdings from ${istTime(c.snapshotAt, { day: "numeric", month: "short" })}; tonight's run picks up your latest.` : ""}
      </p>
    </div>
  );
}
