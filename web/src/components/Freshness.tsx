import { freshness, nightlyIsLate } from "@/lib/freshness";
import { istTime } from "@/lib/format";

const DAY_TIME: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };
const DAY_ONLY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/** Footer line: when your holdings last came from Kite, and how current the market data is. */
export async function Freshness() {
  const f = await freshness();
  const late = f.nightly ? nightlyIsLate(f.nightly) : false;

  const holdings = f.kiteSyncedAt ? `Holdings from Kite, ${istTime(f.kiteSyncedAt, DAY_TIME)}` : "Holdings not pulled yet";
  let market: React.ReactNode = "Market data: no nightly run yet";
  if (f.nightly?.status === "failed") {
    market = <span className="text-loss">Last nightly run failed ({istTime(f.nightly.finishedAt, DAY_TIME)}); showing older market data</span>;
  } else if (f.nightly) {
    const close = f.nightly.latestDate ? `${istTime(f.nightly.latestDate + "T12:00:00+05:30", DAY_ONLY)} close` : "no closes yet";
    market = (
      <span className={late ? "text-warn" : undefined} title={f.nightly.summary ?? undefined}>
        Market data to {close}
        {late ? `, last updated ${istTime(f.nightly.finishedAt, DAY_ONLY)}` : ""}
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-1 md:flex-row md:gap-3">
      <span>{holdings}</span>
      <span aria-hidden className="hidden md:inline">·</span>
      {market}
    </span>
  );
}
