"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { Chart } from "@/components/kit/Chart";
import { QuadrantChip } from "@/components/kit/QuadrantChip";
import { Skeleton } from "@/components/kit/States";
import { readToken } from "@/lib/chartTheme";
import { QUADRANTS, type Quadrant } from "@/lib/quadrant";
import { narrowText, since, standing, toQuadrant, type BenchmarkKey, type IndexRow } from "@/lib/rotationShared";
import { supabaseBrowser } from "@/lib/supabase/client";
import { rsiWords } from "@/lib/indicatorsShared";

const DAY = 24 * 60 * 60 * 1000;
const RETURN_DAYS = 20; // same window as the engine's breadth (about 4 weeks)
const pctSigned = (n: number, d = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d)}%`;
const shareText = (n: number) => `${n >= 9.95 ? Math.round(n) : n.toFixed(1)}%`;
const shortDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });

type Detail = {
  rs: { date: string; value: number }[]; // relative strength, 100 = a year ago
  weeks: { date: string; quadrant: Quadrant }[];
  members: { symbol: string; name: string; ret: number | null }[];
  rsi: number | null; // the index's RSI(14)
};

async function loadDetail(key: string, bench: BenchmarkKey, asOf: string): Promise<Detail> {
  const sb = supabaseBrowser();
  const yearAgo = new Date(new Date(asOf).getTime() - 366 * DAY).toISOString().slice(0, 10);
  const [scores, members, rsiRow] = await Promise.all([
    sb.from("rotation_scores").select("date, rs, quadrant, settled_quadrant, week_end").eq("index_key", key).eq("benchmark_key", bench).gte("date", yearAgo).order("date").limit(1000),
    sb.from("index_constituents").select("symbol, company_name").eq("index_key", key).limit(1000),
    sb.from("latest_indicators").select("rsi14").eq("kind", "index").eq("key", key).maybeSingle(),
  ]);
  if (scores.error) throw scores.error;
  if (members.error) throw members.error;
  const s = (scores.data ?? []) as { date: string; rs: string | number; quadrant: string; settled_quadrant: string | null; week_end: boolean }[];
  const base = s.length ? Number(s[0].rs) : 1;

  // Members' prices for the last ~6 weeks, adjusted for splits by chaining close / NSE's previous close.
  const syms = ((members.data ?? []) as { symbol: string; company_name: string | null }[]).filter((m) => m.symbol);
  const since = new Date(new Date(asOf).getTime() - 45 * DAY).toISOString().slice(0, 10);
  const px: { symbol: string; date: string; close: number | string; prev_close: number | string | null }[] = [];
  for (let from = 0; syms.length; from += 1000) {
    const { data, error } = await sb
      .from("stock_prices")
      .select("symbol, date, close, prev_close")
      .in("symbol", syms.map((m) => m.symbol))
      .gte("date", since)
      .order("symbol")
      .order("date")
      .range(from, from + 999);
    if (error) throw error;
    px.push(...((data ?? []) as typeof px));
    if (!data || data.length < 1000) break;
  }
  const bySym = new Map<string, typeof px>();
  for (const p of px) bySym.set(p.symbol, [...(bySym.get(p.symbol) ?? []), p]);
  const ret = (sym: string) => {
    const rows = bySym.get(sym) ?? [];
    if (rows.length < RETURN_DAYS + 1 || rows[rows.length - 1].date !== asOf) return null;
    let level = 1;
    const levels = rows.map((r, i) => {
      const c = Number(r.close), pc = Number(r.prev_close);
      if (i > 0 && pc > 0 && c / pc > 0.2 && c / pc < 5) level *= c / pc;
      return level;
    });
    return 100 * (levels[levels.length - 1] / levels[levels.length - 1 - RETURN_DAYS] - 1);
  };

  return {
    rs: s.map((r) => ({ date: r.date, value: (100 * Number(r.rs)) / base })),
    weeks: s.filter((r) => r.week_end).map((r) => ({ date: r.date, quadrant: (toQuadrant(r.settled_quadrant) ?? toQuadrant(r.quadrant))! })).filter((w) => w.quadrant),
    members: syms.map((m) => ({ symbol: m.symbol, name: m.company_name ?? m.symbol, ret: ret(m.symbol) })),
    rsi: rsiRow.data?.rsi14 !== undefined && rsiRow.data?.rsi14 !== null ? Number(rsiRow.data.rsi14) : null,
  };
}

/** One sector in depth: a year against the benchmark, its quadrant each week, its members, and your holdings in it. */
export function DetailPanel({ row, benchmark, benchmarkKey, asOf, onClose }: { row: IndexRow; benchmark: string; benchmarkKey: BenchmarkKey; asOf: string; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    setDetail(null);
    setFailed(false);
    loadDetail(row.key, benchmarkKey, asOf)
      .then((d) => live && setDetail(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [row.key, benchmarkKey, asOf]);

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const rsOption = useMemo(() => {
    if (!detail?.rs.length) return null;
    return (): EChartsCoreOption => ({
      animation: false,
      grid: { left: 40, right: 12, top: 12, bottom: 28 },
      tooltip: { trigger: "axis", valueFormatter: (v: number) => v.toFixed(1) },
      xAxis: { type: "category", data: detail.rs.map((p) => p.date), axisLabel: { formatter: (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }) }, boundaryGap: false },
      yAxis: { type: "value", scale: true, splitLine: { show: false } },
      series: [
        {
          type: "line",
          name: `${row.label} ÷ ${benchmark}`,
          data: detail.rs.map((p) => Number(p.value.toFixed(2))),
          lineStyle: { color: readToken("ink"), width: 1.5 },
          itemStyle: { color: readToken("ink") },
          markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: readToken("ink-3"), type: "dashed", width: 1 }, data: [{ yAxis: 100 }] },
        },
      ],
    });
  }, [detail, row.label, benchmark]);

  const year = detail?.rs.length ? detail.rs[detail.rs.length - 1].value - 100 : null;
  const ranked = (detail?.members ?? []).filter((m) => m.ret !== null).sort((a, b) => b.ret! - a.ret!);
  const up = ranked.filter((m) => m.ret! > 0).length;
  const yours = new Set(row.held?.holdings.map((h) => h.symbol));
  const best = ranked.slice(0, 5);
  const worst = ranked.length > 10 ? ranked.slice(-5).reverse() : ranked.slice(5).reverse();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 hidden bg-ink/30 md:block" tabIndex={-1} />
      <div role="dialog" aria-modal="true" aria-labelledby="detail-title" className="relative flex h-full w-full flex-col overflow-y-auto bg-paper md:w-[560px] md:border-l md:border-ink">
        <div className="sticky top-0 z-10 flex items-baseline justify-between gap-4 border-b border-ink bg-paper px-5 py-4 md:px-7">
          <div className="flex flex-col gap-1">
            <h2 id="detail-title" className="text-[26px] font-semibold leading-tight">{row.label}</h2>
            <span className="flex flex-wrap items-baseline gap-x-2">
              <QuadrantChip quadrant={row.now.quadrant} />
              <span className="font-sans text-caption text-ink-3">{since(row)}</span>
            </span>
          </div>
          <button ref={closeBtn} type="button" onClick={onClose} className="inline-flex h-11 items-center border border-ink px-4 font-sans text-ui font-semibold hover:bg-paper-2">
            Close
          </button>
        </div>

        <div className="flex flex-col gap-7 px-5 py-6 md:px-7">
          <p className="text-lead leading-snug">
            {cap(standing(row, benchmark))}.
            {row.breadth ? ` ${Math.round(row.breadth.pctAbove)}% of its ${row.breadth.members} stocks are above their 50-day average.` : ""}
            {row.breadth?.narrow ? ` The move is narrow: the ${narrowText(row.breadth)} over 4 weeks.` : ""}
            {detail?.rsi !== null && detail?.rsi !== undefined ? ` The index's RSI is ${Math.round(detail.rsi)}: ${rsiWords(detail.rsi)}.` : ""}
          </p>

          {row.held ? (
            <section className="flex flex-col gap-2">
              <h3 className="border-b-2 border-ink pb-1 text-[20px] font-semibold">Your money here · {shareText(row.held.share)}</h3>
              <ul className="flex flex-col">
                {row.held.holdings.map((h) => (
                  <li key={h.symbol} className="flex items-baseline justify-between gap-4 border-b border-rule py-2">
                    <span className="flex flex-col">
                      <span className="font-semibold">{h.symbol}</span>
                      <span className="font-sans text-caption text-ink-3">{h.name}</span>
                    </span>
                    <span className="figures">{shareText(h.share)}</span>
                  </li>
                ))}
              </ul>
              {row.held.proxy ? <p className="font-sans text-caption text-ink-3">{row.held.sectors.join(", ")} has no index of its own; this is the closest one.</p> : null}
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <h3 className="border-b-2 border-ink pb-1 text-[20px] font-semibold">
              A year against the {benchmark}
              {year !== null ? <span className="figures ml-2 font-normal text-ink-3">{pctSigned(year)}</span> : null}
            </h3>
            {failed ? (
              <p className="text-ink-2">This didn&apos;t load. Close the panel and open it again to retry.</p>
            ) : rsOption ? (
              <Chart option={rsOption} height={200} label={`${row.label} divided by the ${benchmark} over the last year, starting at 100; ${year !== null ? pctSigned(year) : ""} overall`} />
            ) : (
              <Skeleton className="h-[200px] w-full" />
            )}
            <p className="font-sans text-caption text-ink-3">Rising means {row.label} did better than the {benchmark}; 100 is where it stood a year ago.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="border-b-2 border-ink pb-1 text-[20px] font-semibold">Its quadrant each week</h3>
            {detail ? (
              <>
                <div className="flex gap-[2px]" role="img" aria-label={`${row.label}'s quadrant over the last ${detail.weeks.length} weeks, oldest first`}>
                  {detail.weeks.map((w) => (
                    <span key={w.date} title={`Week to ${shortDate(w.date)}: ${QUADRANTS[w.quadrant].label}`} className={`h-6 flex-1 ${QUADRANTS[w.quadrant].bg}`} />
                  ))}
                </div>
                <div className="flex justify-between font-sans text-caption text-ink-3">
                  <span>{detail.weeks[0] ? shortDate(detail.weeks[0].date) : ""}</span>
                  <span>{detail.weeks.length ? `${detail.weeks.length} weeks` : ""}</span>
                  <span>{detail.weeks.length ? shortDate(detail.weeks[detail.weeks.length - 1].date) : ""}</span>
                </div>
                <p className="flex flex-wrap gap-x-4 gap-y-1">
                  {(["leading", "weakening", "lagging", "improving"] as Quadrant[]).map((q) => (
                    <span key={q} className="inline-flex items-baseline gap-1.5">
                      <QuadrantChip quadrant={q} />
                      <span className="figures font-sans text-caption text-ink-3">{detail.weeks.filter((w) => w.quadrant === q).length}</span>
                    </span>
                  ))}
                </p>
              </>
            ) : failed ? null : (
              <Skeleton className="h-6 w-full" />
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="border-b-2 border-ink pb-1 text-[20px] font-semibold">Its stocks over 4 weeks</h3>
            {detail ? (
              ranked.length ? (
                <>
                  <p className="text-ink-2">
                    {up} of {ranked.length} are up over the last 20 trading days.
                  </p>
                  <MemberList title="Biggest gains" items={best} yours={yours} />
                  {worst.length ? <MemberList title="Biggest falls" items={worst} yours={yours} /> : null}
                  <p className="font-sans text-caption text-ink-3">NSE&apos;s member lists don&apos;t publish weights, so stocks are ranked by their move, not by size. Prices adjusted for splits and bonuses.</p>
                </>
              ) : (
                <p className="text-ink-2">No member prices for this index yet.</p>
              )
            ) : failed ? null : (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function MemberList({ title, items, yours }: { title: string; items: { symbol: string; name: string; ret: number | null }[]; yours: Set<string> }) {
  return (
    <div className="flex flex-col">
      <span className="font-sans text-caption font-semibold uppercase tracking-[0.12em] text-ink-3">{title}</span>
      <ul className="flex flex-col">
        {items.map((m) => (
          <li key={m.symbol} className="flex items-baseline justify-between gap-4 border-b border-rule py-2">
            <span className={`flex flex-col ${yours.has(m.symbol) ? "font-semibold" : ""}`}>
              <span>
                {m.name}
                {yours.has(m.symbol) ? <span className="font-sans text-caption font-normal text-ink-3"> · you hold this</span> : null}
              </span>
            </span>
            <span className={`figures ${m.ret! > 0 ? "text-gain" : m.ret! < 0 ? "text-loss" : ""}`}>{pctSigned(m.ret!)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
