import Link from "next/link";
import { EmptyState, Kicker, SectionHeader } from "@/components/Section";
import { ErrorState } from "@/components/kit/States";
import { LinkButton } from "@/components/kit/Button";
import { QuadrantChip } from "@/components/kit/QuadrantChip";
import { QUADRANTS } from "@/lib/quadrant";
import {
  BENCHMARK_KEYS,
  BENCHMARK_LABELS,
  CLOCKWISE,
  biggestMoves,
  isBenchmarkKey,
  loadRotation,
  rotationDek,
  rotationHeadline,
  sinceShort,
  standing,
  type BenchmarkKey,
  type IndexRow,
} from "@/lib/rotation";
import { fromRow } from "@/lib/settings";
import { currentUser, supabaseServer } from "@/lib/supabase/server";
import { RotationChart } from "./RotationChart";

export const metadata = { title: "Rotation · Fund X-Ray" };

const weekOf = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const shareText = (n: number) => `${n >= 9.95 ? Math.round(n) : n.toFixed(1)}%`;

async function defaultBenchmark(userId: string): Promise<BenchmarkKey> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("settings").select("benchmark").eq("user_id", userId).maybeSingle();
  return BENCHMARK_KEYS[fromRow((data ?? {}) as Record<string, unknown>).benchmark];
}

export default async function RotationPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const user = await currentUser();
  if (!user) return null;
  const mine = await defaultBenchmark(user.id);
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

      <section className="flex flex-col gap-4 py-7">
        <SectionHeader title="Every sector by quadrant" aside="Strongest first" />
        <QuadrantLists rows={rows} />
      </section>
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

function QuadrantLists({ rows }: { rows: IndexRow[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {CLOCKWISE.map((q) => {
        const inQ = rows.filter((r) => r.now.quadrant === q).sort((a, b) => b.now.ratio - a.now.ratio);
        return (
          <div key={q} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between border-b border-ink pb-1">
              <QuadrantChip quadrant={q} />
              <span className="font-sans text-caption text-ink-3">{inQ.length || "None"}</span>
            </div>
            <p className="font-sans text-caption text-ink-3">{QUADRANTS[q].blurb}</p>
            <ul className="flex flex-col">
              {inQ.map((r) => (
                <li key={r.key} className="flex items-baseline justify-between gap-3 border-b border-rule py-2">
                  <span className={`flex flex-col ${r.held ? "font-semibold text-ink" : "text-ink-2"}`}>
                    <span>{r.label}</span>
                    <span className="font-sans text-caption font-normal text-ink-3">
                      {r.nearLine ? "On the line · " : ""}
                      {r.prev && r.prev.quadrant !== q ? `New, was ${QUADRANTS[r.prev.quadrant].label}` : ""}
                      {r.prev && r.prev.quadrant !== q ? " · " : ""}
                      <span className="figures">{r.now.ratio.toFixed(2)} / {r.now.momentum.toFixed(2)}</span>
                    </span>
                  </span>
                  {r.held ? <span className="figures shrink-0 font-semibold">{shareText(r.held.share)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
