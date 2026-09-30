import { KiteCard } from "@/components/KiteCard";
import { Notice } from "@/components/Notice";
import { EmptyState, Kicker, SectionHeader } from "@/components/Section";
import { StatTile } from "@/components/kit/StatTile";
import { countWords, istTime, price, rupees, rupeesShort, signedRupees } from "@/lib/format";
import { portfolioDek, portfolioHeadline } from "@/lib/headline";
import { latestSnapshot } from "@/lib/holdings";
import { kiteStatus } from "@/lib/kite";
import { REFRESH_ERRORS } from "@/lib/refresh";
import { currentUser, supabaseServer } from "@/lib/supabase/server";
import { loadConcentration } from "@/lib/concentration";
import { liquidityFor } from "@/lib/liquidity";
import { isIndexFund, plan, rsiFor } from "@/lib/indicators";
import { instrumentKey } from "@/lib/sectorsShared";
import { SETTINGS_COLUMNS, fromRow } from "@/lib/settings";
import { sectorSplit, sectorsFor } from "@/lib/sectors";
import { HoldingsTable } from "./HoldingsTable";
import { WhereMoneySits } from "./WhereMoneySits";
import { PullButton } from "./PullButton";
import { SpreadOut } from "./SpreadOut";
import { Planner } from "./Planner";

export const metadata = { title: "Portfolio · Fund X-Ray" };

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ pull?: string }> }) {
  const { pull } = await searchParams;
  const user = await currentUser();
  if (!user) return null;
  const [kite, snap] = await Promise.all([kiteStatus(user.id), latestSnapshot()]);
  const pullError = pull ? (REFRESH_ERRORS[pull] ?? "The first pull didn't finish. Try Refresh.") : null;

  if (!snap) {
    return (
      <div className="flex flex-col">
        {pullError ? <Notice tone="error">{pullError}</Notice> : null}
        <section className="flex flex-col gap-3 border-b border-ink py-7">
          <Kicker>Your holdings</Kicker>
          <h1 className="text-[30px] font-medium leading-[1.12] tracking-[-0.015em] md:text-h2">No holdings pulled yet</h1>
          <p className="max-w-[60ch] text-body leading-relaxed text-ink-2 md:text-lead">
            Holdings come from Kite each time you refresh; nothing about your portfolio is written into the app.
          </p>
        </section>
        <div className="py-7">
          {kite.state === "connected" ? (
            <EmptyState title="Pull your holdings" body="Zerodha is connected. Fetch your holdings and positions now; it takes a few seconds." action={<PullButton />} />
          ) : (
            <KiteCard status={kite} />
          )}
        </div>
      </div>
    );
  }

  const supabase = await supabaseServer();
  const [sectors, liquidity, concentration, settingsRow, rsi] = await Promise.all([
    sectorsFor(snap.holdings),
    liquidityFor(snap.holdings),
    loadConcentration(user.id),
    supabase.from("settings").select(SETTINGS_COLUMNS).eq("user_id", user.id).maybeSingle(),
    rsiFor(snap.holdings.filter((h) => h.exchange === "NSE").map((h) => h.symbol)),
  ]);
  const settings = fromRow((settingsRow.data ?? {}) as Record<string, unknown>);
  const stockLimit = settings.alert_stock_weight_pct;
  const indexHoldings = snap.holdings.filter((h) => isIndexFund(h.symbol, h.name, sectors[instrumentKey(h)]?.industry === "ETFs & funds"));
  const indexValue = indexHoldings.reduce((s, h) => s + h.value, 0);
  const allocation = plan(snap.totals.value, indexValue, settings.index_target_low, settings.index_target_high, settings.monthly_amount);
  const groups = sectorSplit(snap.holdings, sectors);
  const t = snap.totals;
  const asOf = istTime(snap.taken_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const stale = kite.state !== "connected";

  return (
    <div className="flex flex-col">
      {pullError ? <Notice tone="error">{pullError}</Notice> : null}
      {stale ? (
        <Notice tone="neutral">
          These numbers are from {asOf}. Your Zerodha connection has ended; <a href="/kite/connect">reconnect</a> to refresh them.
        </Notice>
      ) : null}

      <section className="grid gap-7 border-b border-ink py-7 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-12 md:py-8">
        <div className="flex flex-col gap-4">
          <Kicker>Your holdings</Kicker>
          <h1 className="max-w-[22ch] text-[30px] font-medium leading-[1.1] tracking-[-0.015em] md:text-[46px]">{portfolioHeadline(snap)}</h1>
          <p className="max-w-[60ch] text-body leading-relaxed text-ink-2 md:text-lead">{portfolioDek(snap)}</p>
        </div>
        <div className="grid grid-cols-2 content-start gap-x-6 gap-y-5">
          <StatTile label="Invested" value={<Compact n={t.invested} />} />
          <StatTile label="Today" value={<Compact n={t.day_change} signed />} change={t.day_change_pct} />
          <StatTile label="Total return" value={<Compact n={t.pnl} signed />} change={t.pnl_pct} changeLabel="overall" />
          <StatTile label="Holdings" value={t.holdings_count} asOf={asOf} />
        </div>
      </section>

      <section className="flex flex-col gap-4 border-b border-ink py-7">
        <SectionHeader title="Where the money sits" aside={`${groups.filter((g) => g.sector !== "Unmapped").length} sectors`} />
        <WhereMoneySits groups={groups} asOf={asOf} />
      </section>

      <section className="flex flex-col gap-4 border-b border-ink py-7">
        <SectionHeader title="How spread out you are" aside={concentration ? "Weekly prices, last 12 months" : undefined} />
        <SpreadOut c={concentration} snapshotAt={snap.taken_at} />
      </section>

      <section className="flex flex-col gap-4 border-b border-ink py-7">
        <SectionHeader title="Index share and next month" aside={`Target ${settings.index_target_low}–${settings.index_target_high}%`} />
        <Planner p={allocation} indexValue={indexValue} monthly={settings.monthly_amount} funds={indexHoldings.map((h) => h.symbol)} />
      </section>

      <section id="holdings" className="flex scroll-mt-4 flex-col gap-4 py-7">
        <SectionHeader title="Holdings" aside={`Worth ${rupees(t.value)}`} />
        <HoldingsTable holdings={snap.holdings} sectors={sectors} liquidity={liquidity} stockLimit={stockLimit} rsi={rsi} />
        <p className="font-sans text-caption text-ink-3">
          Source: Zerodha Kite, holdings as of {asOf} IST. Totals worked out by Fund X-Ray; quantities include T1 shares. Shares bought today appear
          under Positions until tomorrow. Days to sell assumes you sell no more than 10% of the stock&apos;s average daily NSE volume over
          the last 20 sessions, so your own selling doesn&apos;t move the price; flagged above 5 days. RSI is the 14-day
          relative strength index from NSE closes (adjusted for splits): it describes how hard the price has moved recently, not where it goes next.
        </p>
      </section>

      {snap.positions.length ? (
        <section className="flex flex-col gap-3 pb-7">
          <SectionHeader title="Positions today" aside={`${countWords(snap.positions.length, "position")}, ${signedRupees(t.positions_pnl)}`} />
          <ul className="flex flex-col">
            {snap.positions.map((p) => (
              <li key={`${p.exchange}:${p.symbol}:${p.product}`} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                <span className="flex flex-col">
                  <span className="font-semibold">{p.symbol}</span>
                  <span className="font-sans text-caption text-ink-3">
                    {p.product} · {p.quantity} at {price(p.avg_price)}
                  </span>
                </span>
                <span className={`figures ${p.pnl > 0 ? "text-gain" : p.pnl < 0 ? "text-loss" : "text-ink-3"}`}>{signedRupees(p.pnl)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Full rupees on desktop; the tile is narrow on phones, so lakhs and crores there. */
function Compact({ n, signed = false }: { n: number; signed?: boolean }) {
  const full = signed ? signedRupees(n) : rupees(n);
  return (
    <>
      <span className="hidden lg:inline">{full}</span>
      <span className="lg:hidden">{signed && n > 0 ? "+" : ""}{rupeesShort(n)}</span>
    </>
  );
}

