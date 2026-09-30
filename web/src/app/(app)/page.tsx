import Link from "next/link";
import { KiteCard } from "@/components/KiteCard";
import { RotationCard } from "@/components/RotationCard";
import { Notice } from "@/components/Notice";
import { EmptyState, Kicker, SectionHeader } from "@/components/Section";
import { QuadrantChip } from "@/components/kit/QuadrantChip";
import { rupees, signedPct } from "@/lib/format";
import { portfolioHeadline } from "@/lib/headline";
import { latestSnapshot } from "@/lib/holdings";
import { KITE_NOTICES, kiteStatus } from "@/lib/kite";
import { BENCHMARK_LABELS, loadRotation, moneyByQuadrant, sinceShort, standing, userBenchmark } from "@/lib/rotation";
import { currentUser } from "@/lib/supabase/server";

const pctText = (n: number) => `${n >= 9.95 ? Math.round(n) : n.toFixed(1)}%`;
const weekOf = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SHOWN = 5;

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ kite?: string }> }) {
  const { kite: code } = await searchParams;
  const user = await currentUser();
  if (!user) return null;
  const notice = code ? (KITE_NOTICES[code] ?? KITE_NOTICES.error) : null;
  const benchmark = await userBenchmark(user.id);
  const name = BENCHMARK_LABELS[benchmark];
  const [status, snap, rot] = await Promise.all([kiteStatus(user.id), latestSnapshot(), loadRotation(benchmark)]);

  const rows = rot.state === "ok" ? rot.rows : [];
  const held = rows.filter((r) => r.held).sort((a, b) => b.held!.share - a.held!.share);
  const m = moneyByQuadrant(rows);
  const gaining = m.leading + m.improving;
  const losing = m.weakening + m.lagging;

  // The lead: where your money sits against the market, in one sentence.
  let kicker = "Your alignment";
  let headline: string;
  let dek: string;
  if (!snap) {
    headline = status.state === "connected" ? "Pull your holdings to see where your money sits" : "Connect Zerodha to see where your money sits";
    dek = "Fund X-Ray reads your holdings, maps each stock to its sector, and tells you how much of your money sits in sectors gaining or losing strength against the market.";
  } else if (rot.state !== "ok" || !held.length) {
    headline = portfolioHeadline(snap);
    dek = rot.state === "ok" ? "None of your holdings sit in a sector with an NSE index yet." : "Sector scores didn't load just now; your holdings are below.";
  } else {
    kicker = `Your alignment · week to ${weekOf(rot.asOf)}`;
    headline = `${pctText(gaining)} of your money is in sectors gaining on the ${name}; ${pctText(losing)} is in sectors losing ground`;
    const rest = rot.unmappedShare !== null && rot.unmappedShare >= 0.05 ? ` The other ${pctText(rot.unmappedShare)} is in sectors without an index.` : "";
    dek = `${portfolioHeadline(snap)}. Leading ${pctText(m.leading)}, Improving ${pctText(m.improving)}, Weakening ${pctText(m.weakening)}, Lagging ${pctText(m.lagging)}.${rest}`;
  }

  const t = snap?.totals;

  return (
    <div className="flex flex-col">
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <section className="flex flex-col gap-4 border-b border-ink py-7 md:py-8">
        <Kicker>{kicker}</Kicker>
        <h1 className="max-w-[26ch] text-[30px] font-medium leading-[1.1] tracking-[-0.015em] md:text-[46px]">{headline}</h1>
        <p className="figures max-w-[64ch] text-body leading-relaxed text-ink-2 md:text-lead">{dek}</p>
      </section>

      {status.state !== "connected" ? (
        <div className="pt-7">
          <KiteCard status={status} />
        </div>
      ) : null}

      <div className="grid gap-x-12 border-b border-ink md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="flex flex-col gap-3 py-7">
          <SectionHeader title="Your sectors this week" aside={held.length ? `Against the ${name}` : undefined} />
          {held.length ? (
            <>
              <ul className="flex flex-col">
                {held.slice(0, SHOWN).map((r) => (
                  <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-rule py-3">
                    <span className="font-semibold">
                      {r.label} <span className="figures font-normal text-ink-3">· {pctText(r.held!.share)}</span>
                    </span>
                    <span className="flex items-baseline gap-1.5">
                      <QuadrantChip quadrant={r.now.quadrant} />
                      <span className="font-sans text-caption text-ink-3">· {sinceShort(r)}</span>
                    </span>
                    <span className="col-span-2 text-body leading-snug text-ink-2">{cap(standing(r, name))}.</span>
                  </li>
                ))}
              </ul>
              <Link href="/rotation" className="font-sans text-ui font-semibold">
                {held.length > SHOWN ? `All ${held.length} of your sectors, and the rest →` : "Every sector →"}
              </Link>
            </>
          ) : (
            <p className="text-body text-ink-2">
              {snap ? "None of your holdings sit in a sector with an NSE index." : "Your sectors appear here once your holdings are in."}
            </p>
          )}
        </section>

        <div className="flex flex-col gap-6 py-7">
          {t ? (
            <div className="flex flex-col items-start gap-3 border border-ink p-5 md:p-6">
              <Kicker>Portfolio</Kicker>
              <p className="figures text-[26px] font-semibold leading-tight">{rupees(t.value)}</p>
              <p className="figures text-body leading-relaxed text-ink-2">
                {Math.round(t.day_change) === 0 ? "Flat today" : `${t.day_change > 0 ? "Up" : "Down"} ${rupees(Math.abs(t.day_change))} today`}
                {`; ${t.pnl >= 0 ? "up" : "down"} ${rupees(Math.abs(t.pnl))} (${signedPct(t.pnl_pct)}) on ${rupees(t.invested)} put in.`}
              </p>
              <Link href="/portfolio" className="font-sans text-ui font-semibold">
                See holdings →
              </Link>
            </div>
          ) : null}
          <RotationCard userId={user.id} />
        </div>
      </div>

      <div className="py-7">
        <EmptyState
          title="Health checks"
          body="Surveillance lists, red flags, promoter pledges and exit liquidity for whatever you hold."
          action={
            <Link href="/health" className="font-sans text-ui">
              Arrives in week 4
            </Link>
          }
        />
      </div>
    </div>
  );
}
