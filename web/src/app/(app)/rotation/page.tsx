import Link from "next/link";
import { EmptyState, Kicker, SectionHeader } from "@/components/Section";
import { ErrorState } from "@/components/kit/States";
import { LinkButton } from "@/components/kit/Button";
import { QuadrantChip } from "@/components/kit/QuadrantChip";
import {
  BENCHMARK_LABELS,
  CYCLICAL_NAMES,
  DEFENSIVE_NAMES,
  biggestMoves,
  isBenchmarkKey,
  loadRotation,
  rotationDek,
  rotationHeadline,
  sinceShort,
  standing,
  userBenchmark,
  type BenchmarkKey,
  type RegimeInfo,
} from "@/lib/rotation";
import { currentUser } from "@/lib/supabase/server";
import { RotationChart } from "./RotationChart";
import { RotationTable } from "./RotationTable";

export const metadata = { title: "Rotation · Fund X-Ray" };

const weekOf = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const shareText = (n: number) => `${n >= 9.95 ? Math.round(n) : n.toFixed(1)}%`;

export default async function RotationPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const user = await currentUser();
  if (!user) return null;
  const mine = await userBenchmark(user.id);
  const benchmark = isBenchmarkKey(b) ? b : mine;
  const name = BENCHMARK_LABELS[benchmark];
  const data = await loadRotation(benchmark);

  const switcher = <BenchmarkSwitch current={benchmark} mine={mine} />;

  if (data.state === "error") {
    return (
      <div className="flex flex-col gap-5 py-7">
        {switcher}
        <ErrorState
          title="Rotation didn't load"
          body="The database didn't answer, so there's nothing to show yet. Your holdings and settings are unchanged."
          action={<LinkButton variant="secondary" href={`/rotation?b=${benchmark}`}>Try again</LinkButton>}
        />
      </div>
    );
  }
  if (data.state === "empty") {
    return (
      <div className="flex flex-col gap-5 py-7">
        <section className="flex flex-col gap-3">
          <Kicker>Sector rotation</Kicker>
          <h1 className="text-[30px] font-medium leading-[1.12] tracking-[-0.015em] md:text-h2">No rotation scores yet</h1>
        </section>
        {switcher}
        <EmptyState
          title={`Nothing computed against the ${name} yet`}
          body="Scores come from the nightly market-data run. If this stays empty after tonight, run Actions → NSE data → refill once on GitHub."
        />
      </div>
    );
  }

  const { rows, asOf } = data;
  const mine_ = rows.filter((r) => r.held).sort((a, b) => b.held!.share - a.held!.share);
  const moves = biggestMoves(rows, name);

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-4 border-b border-ink py-7 md:py-8">
        <Kicker>Sector rotation · week to {weekOf(asOf)}</Kicker>
        <h1 className="max-w-[28ch] text-[30px] font-medium leading-[1.1] tracking-[-0.015em] md:text-[46px]">{rotationHeadline(rows)}</h1>
        <p className="max-w-[64ch] text-body leading-relaxed text-ink-2 md:text-lead">{rotationDek(rows, name, data.unmappedShare)}</p>
        {switcher}
      </section>

      <div className="grid gap-x-12 border-b border-ink md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="flex flex-col gap-3 py-7">
          <SectionHeader title="Your sectors this week" aside={mine_.length ? `Against the ${name}` : undefined} />
          {mine_.length ? (
            <ul className="flex flex-col">
              {mine_.map((r) => (
                <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-rule py-3">
                  <span className="font-semibold">
                    {r.label} <span className="figures font-normal text-ink-3">· {shareText(r.held!.share)} of your money</span>
                  </span>
                  <span className="flex items-baseline gap-1.5">
                    <QuadrantChip quadrant={r.now.quadrant} />
                    <span className="font-sans text-caption text-ink-3">· {sinceShort(r)}</span>
                  </span>
                  <span className="col-span-2 text-body leading-snug text-ink-2">
                    {cap(standing(r, name))}.
                    {r.held!.proxy ? <span className="text-ink-3"> ({r.held!.sectors.join(", ")} shown by its closest index.)</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-ink-2">
              {data.hasHoldings ? "None of your holdings sit in a sector with an NSE index." : "Pull your holdings on the Portfolio page to see your sectors here."}
            </p>
          )}
        </section>
        <section className="flex flex-col gap-3 py-7">
          <SectionHeader title="Biggest moves elsewhere" aside="Sectors you don't hold" />
          {moves.length ? (
            <ul className="flex flex-col">
              {moves.map((m) => (
                <li key={m.row.key} className="flex flex-col gap-1 border-b border-rule py-3">
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="font-semibold">{m.row.label}</span>
                    <QuadrantChip quadrant={m.row.now.quadrant} />
                  </span>
                  <span className="text-body leading-snug text-ink-2">{cap(m.text)}.</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-ink-2">A quiet week: no other sector changed quadrant or moved more than 2 points in 4 weeks.</p>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-4 border-b border-ink py-7">
        <SectionHeader title="The map" aside={`${rows.length} indices`} />
        <RotationChart rows={rows} benchmark={name} />
        <p className="font-sans text-caption leading-relaxed text-ink-3">
          Source: NSE index closes to {weekOf(asOf)}, one dot per week. Rotation quadrants, not RRG: Ratio compares each index with the {name}{" "}
          against its own 50-day average; Momentum is the change in Ratio over 10 trading days. A sector keeps its label until it crosses a line
          by more than half a point.
        </p>
      </section>

      <HowItWorks benchmark={name} />

      <section className="flex flex-col gap-5 py-7">
        <SectionHeader title="Every sector" aside="Tap a name for its detail" />
        {data.regime ? <RegimeLine r={data.regime} /> : null}
        <RotationTable rows={rows} benchmark={name} benchmarkKey={benchmark} asOf={asOf} />
        <p className="font-sans text-caption leading-relaxed text-ink-3">
          Ratio, 4 wks: change in Ratio over four weeks. Above 50-day: share of the index&apos;s stocks trading above their own 50-day average. Narrow: the
          index moved more than 3 points away from its average stock over 20 trading days, so a few large companies carried it.
        </p>
      </section>
    </div>
  );
}

/** The calculation in five short steps, folded away until asked for. */
function HowItWorks({ benchmark }: { benchmark: string }) {
  const steps: [string, string][] = [
    ["Relative strength", `Each day, the sector index divided by the ${benchmark}. Rising means the sector beat the market that day. Everything here is relative: a sector can be "ahead" while still losing money, if the market fell further.`],
    ["Ratio", "Today's relative strength against its own average over the last 50 trading days, where 100 is normal. Above 100 the sector is ahead, below it behind."],
    ["Momentum", "Today's Ratio against the Ratio two weeks (10 trading days) earlier. Above 100 the lead is growing or the gap closing; below it, the opposite."],
    ["Quadrant", "The two together: Leading (ahead, gaining), Weakening (ahead, slowing), Lagging (behind, slipping), Improving (behind, recovering). Sectors tend to move round clockwise. A label only changes once a sector crosses a line by more than half a point."],
    ["Your money", "Each holding's NSE sector is matched to its closest index, and your holdings are added up per index. Funds and sectors without an index are counted separately."],
  ];
  return (
    <details className="group border-b border-ink py-5">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 font-sans text-ui font-semibold text-ink">
        How these numbers are worked out
        <span aria-hidden className="text-ink-3 group-open:hidden">Show</span>
        <span aria-hidden className="hidden text-ink-3 group-open:inline">Hide</span>
      </summary>
      <ol className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex flex-col gap-1">
            <span className="font-sans text-caption font-semibold uppercase tracking-[0.12em] text-accent">
              {i + 1}. {title}
            </span>
            <span className="text-ui leading-relaxed text-ink-2">{body}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 font-sans text-caption text-ink-3">
        It describes the last few weeks, not the future, and none of it is advice to buy or sell.
      </p>
    </details>
  );
}

const regimeTone: Record<RegimeInfo["regime"], string> = { "Cyclical lead": "text-q-leading", "Defensive lead": "text-q-weakening", Neutral: "text-ink" };
const signedPts = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

/** The regime, the rule that produced it, and this week's numbers. Always measured against the Nifty 500. */
function RegimeLine({ r }: { r: RegimeInfo }) {
  const held = r.weeks >= 12 ? "for 12 weeks or more" : r.weeks === 1 ? `new this week${r.prev ? `, after ${r.prev}` : ""}` : `for ${r.weeks} weeks`;
  return (
    <div className="flex flex-col gap-2 border border-ink p-4 md:p-5">
      <p className="text-lead">
        <span className="font-sans text-caption font-semibold uppercase tracking-[0.12em] text-ink-3">Regime </span>
        <span className={`font-semibold ${regimeTone[r.regime]}`}>{r.regime}</span>
        <span className="text-ink-3"> · {held}</span>
      </p>
      <p className="max-w-[80ch] text-ui leading-relaxed text-ink-2">
        The rule: <strong>Cyclical lead</strong> when the average Ratio of {CYCLICAL_NAMES} beats that of {DEFENSIVE_NAMES} by more than {r.threshold} and
        over {r.breadthMin}% of Nifty 500 stocks are above their 50-day average; <strong>Defensive lead</strong> when it trails by more than {r.threshold};
        otherwise <strong>Neutral</strong>. Always against the Nifty 500.
      </p>
      <p className="figures font-sans text-ui text-ink">
        This week: cyclical − defensive = {signedPts(r.spread)} ({r.cyclical.toFixed(2)} vs {r.defensive.toFixed(2)})
        {r.marketBreadth !== null ? `; market breadth ${Math.round(r.marketBreadth)}%` : ""}.
      </p>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function BenchmarkSwitch({ current, mine }: { current: BenchmarkKey; mine: BenchmarkKey }) {
  const keys = Object.keys(BENCHMARK_LABELS) as BenchmarkKey[];
  return (
    <nav aria-label="Benchmark" className="flex flex-wrap items-center gap-x-1 gap-y-2 font-sans text-ui">
      <span className="mr-2 text-caption text-ink-3">Against</span>
      {keys.map((k) => (
        <Link
          key={k}
          href={k === mine ? "/rotation" : `/rotation?b=${k}`}
          aria-current={k === current ? "page" : undefined}
          className={`inline-flex h-11 items-center border px-3 no-underline md:h-9 ${
            k === current ? "border-ink bg-ink text-paper hover:text-paper" : "border-rule text-ink-2 hover:bg-paper-2"
          }`}
        >
          {BENCHMARK_LABELS[k]}
          {k === mine ? <span className="sr-only"> (your default)</span> : null}
        </Link>
      ))}
      <span className="ml-2 text-caption text-ink-3">Default {BENCHMARK_LABELS[mine]}, set in <Link href="/settings">Settings</Link></span>
    </nav>
  );
}

