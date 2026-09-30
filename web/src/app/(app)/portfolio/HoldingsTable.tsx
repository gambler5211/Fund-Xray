"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/kit/DataTable";
import { count, pct, price, rupees, signedPct, signedRupees } from "@/lib/format";
import type { HoldingRowData } from "@/lib/holdings";
import { instrumentKey, type SectorMap } from "@/lib/sectorsShared";
import { SLOW_EXIT_DAYS, daysText, holdingFlags, type LiquidityMap } from "@/lib/liquidityShared";
import { rsiWords, type RsiMap } from "@/lib/indicatorsShared";
import { SectorPicker } from "./SectorPicker";

const tone = (n: number) => (n > 0 ? "text-gain" : n < 0 ? "text-loss" : "text-ink-3");

function Money({ value, signed = false }: { value: number; signed?: boolean }) {
  return <span className={signed ? tone(value) : ""}>{signed ? signedRupees(value) : rupees(value)}</span>;
}

function Both({ amount, change }: { amount: number; change: number }) {
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className={tone(amount)}>{signedRupees(amount)}</span>
      <span className={`font-sans text-caption ${tone(change)}`}>{signedPct(change)}</span>
    </span>
  );
}

function Flags({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <span className="flex flex-col font-sans text-caption text-warn">
      {items.map((f) => (
        <span key={f}>⚑ {f}</span>
      ))}
    </span>
  );
}

function columns(sectors: SectorMap, liquidity: LiquidityMap, stockLimit: number, rsi: RsiMap): ColumnDef<HoldingRowData, unknown>[] {
  const days = (h: HoldingRowData) => liquidity[instrumentKey(h)]?.days ?? null;
  return [
  {
    id: "name",
    header: "Company",
    accessorFn: (h) => h.name,
    cell: ({ row: { original: h } }) => (
      <span className="flex flex-col leading-tight">
        <span className="font-semibold">{h.name}</span>
        <span className="font-sans text-caption text-ink-3">
          {h.symbol}
          {h.notes.length ? ` · ${h.notes.join(" · ")}` : ""}
        </span>
        <Flags items={holdingFlags(h.weight_pct, days(h), stockLimit)} />
      </span>
    ),
  },
  {
    id: "sector",
    header: "Sector",
    accessorFn: (h) => sectors[instrumentKey(h)]?.industry ?? "~Unmapped",
    cell: ({ row: { original: h } }) => <SectorPicker instrument={instrumentKey(h)} info={sectors[instrumentKey(h)] ?? { industry: null, source: null }} />,
  },
  { id: "qty", header: "Qty", accessorFn: (h) => h.quantity, cell: (c) => count(c.getValue() as number), meta: { align: "right" } },
  { id: "avg", header: "Avg cost", accessorFn: (h) => h.avg_price, cell: (c) => price(c.getValue() as number), meta: { align: "right" } },
  { id: "ltp", header: "Last price", accessorFn: (h) => h.last_price, cell: (c) => price(c.getValue() as number), meta: { align: "right" } },
  { id: "value", header: "Value", accessorFn: (h) => h.value, cell: (c) => <Money value={c.getValue() as number} />, meta: { align: "right" } },
  { id: "day", header: "Today", accessorFn: (h) => h.day_change_pct, cell: ({ row: { original: h } }) => <Both amount={h.day_change} change={h.day_change_pct} />, meta: { align: "right" } },
  { id: "pnl", header: "P/L", accessorFn: (h) => h.pnl_pct, cell: ({ row: { original: h } }) => <Both amount={h.pnl} change={h.pnl_pct} />, meta: { align: "right" } },
  { id: "weight", header: "Weight", accessorFn: (h) => h.weight_pct, cell: (c) => pct(c.getValue() as number), meta: { align: "right" } },
  {
    id: "rsi",
    header: "RSI",
    accessorFn: (h) => rsi[h.symbol] ?? -1,
    cell: ({ row: { original: h } }) => {
      const v = rsi[h.symbol];
      return v === undefined ? <span className="text-ink-3">–</span> : <span title={`RSI ${Math.round(v)}: ${rsiWords(v)}`}>{Math.round(v)}</span>;
    },
    meta: { align: "right" },
  },
  {
    id: "exit",
    header: "Days to sell",
    accessorFn: (h) => days(h) ?? Number.POSITIVE_INFINITY,
    cell: ({ row: { original: h } }) => {
      const d = days(h);
      return <span className={d !== null && d > SLOW_EXIT_DAYS ? "text-warn" : d === null ? "text-ink-3" : ""}>{d === null ? "–" : d < 1 ? "<1" : Math.round(d)}</span>;
    },
    meta: { align: "right" },
  },
  ];
}

/**
 * Holdings set like a stock-listings page. Sort by any column, search by name or symbol, or put the
 * biggest losers (by total P/L %) first. On phones each holding becomes a stacked entry.
 */
export function HoldingsTable({
  holdings,
  sectors,
  liquidity,
  stockLimit,
  rsi,
}: {
  holdings: HoldingRowData[];
  sectors: SectorMap;
  liquidity: LiquidityMap;
  stockLimit: number;
  rsi: RsiMap;
}) {
  const cols = useMemo(() => columns(sectors, liquidity, stockLimit, rsi), [sectors, liquidity, stockLimit, rsi]);
  const [q, setQ] = useState("");
  const [losersFirst, setLosersFirst] = useState(false);

  // "Pick sectors for N stocks" above sets the search to "unmapped"
  useEffect(() => {
    const on = (e: Event) => setQ(String((e as CustomEvent).detail ?? ""));
    window.addEventListener("fx:holdings-search", on);
    return () => window.removeEventListener("fx:holdings-search", on);
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? holdings.filter((h) => h.name.toLowerCase().includes(needle) || h.symbol.toLowerCase().includes(needle) || (sectors[instrumentKey(h)]?.industry ?? "unmapped").toLowerCase().includes(needle)) : holdings;
    return losersFirst ? [...list].sort((a, b) => a.pnl_pct - b.pnl_pct) : list;
  }, [holdings, q, losersFirst, sectors]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 md:max-w-80">
          <span className="sr-only">Search holdings</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search stocks or sectors"
            className="h-10 w-full border border-ink bg-paper px-3 font-sans text-ui text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
        <button
          type="button"
          aria-pressed={losersFirst}
          onClick={() => setLosersFirst((v) => !v)}
          className={`h-10 border px-3 font-sans text-ui font-semibold ${losersFirst ? "border-ink bg-ink text-paper" : "border-ink text-ink hover:bg-paper-2"}`}
        >
          Losers first
        </button>
        <span className="font-sans text-caption text-ink-3" role="status">
          {shown.length === holdings.length ? `${holdings.length} holdings` : `${shown.length} of ${holdings.length}`}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="border-y border-rule py-6 text-center font-sans text-ui text-ink-3">Nothing matches “{q}”.</p>
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable
              key={losersFirst ? "losers" : "all"}
              columns={cols}
              data={shown}
              caption="Your holdings"
              initialSort={losersFirst ? [] : [{ id: "value", desc: true }]}
              maxHeight="70vh"
            />
          </div>
          <ul className="border-t border-ink md:hidden" aria-label="Your holdings">
            {shown.map((h) => (
              <li key={`${h.exchange}:${h.symbol}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-b border-rule py-3">
                <span className="truncate font-semibold">{h.name}</span>
                <span className="figures text-right">{rupees(h.value)}</span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-sans text-caption text-ink-3">
                    {h.symbol} · {pct(h.weight_pct)} of portfolio
                  </span>
                  <SectorPicker instrument={instrumentKey(h)} info={sectors[instrumentKey(h)] ?? { industry: null, source: null }} />
                </span>
                <span className={`figures text-right font-sans text-caption ${tone(h.pnl)}`}>
                  {signedRupees(h.pnl)} ({signedPct(h.pnl_pct)})
                </span>
                <span className="col-span-2 flex flex-col gap-0.5">
                  <span className="figures font-sans text-caption text-ink-3">
                    Days to sell: {daysText(liquidity[instrumentKey(h)]?.days ?? null)}
                    {rsi[h.symbol] !== undefined ? ` · RSI ${Math.round(rsi[h.symbol])}, ${rsiWords(rsi[h.symbol])}` : ""}
                  </span>
                  <Flags items={holdingFlags(h.weight_pct, liquidity[instrumentKey(h)]?.days ?? null, stockLimit)} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
