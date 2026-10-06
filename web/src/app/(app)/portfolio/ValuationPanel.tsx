import { istTime, pct, price } from "@/lib/format";
import { dcfSentence, growthPct, latestSource, monthYear, type Valuation, type ViewInputs } from "@/lib/valuationShared";

export type ValuationItem = { key: string; symbol: string; name: string; weight: number; v: Valuation };

/** ₹23,100 Cr / ₹412 Cr / ₹8.4 Cr: crores with Indian grouping (company-sized sums). */
const crore = (n: number) => {
  const c = n / 1e7;
  return `${c < 0 ? "−" : ""}₹${Math.abs(c).toLocaleString("en-IN", { maximumFractionDigits: Math.abs(c) >= 100 ? 0 : 1 })} Cr`;
};

const num = (x: ViewInputs[string]) => (typeof x === "number" ? x : x === null || x === undefined ? null : Number(x));

/**
 * "What the price assumes": the three valuation views per held stock, side by side, each with its
 * formula, inputs, the filing behind it and the date. Shown only to accounts with valuation
 * access (the page checks; the database refuses the rows to anyone else). One <details> per stock,
 * so it needs no client code and works on phones.
 */
export function ValuationPanel({ items, noFilings }: { items: ValuationItem[]; noFilings: string[] }) {
  if (!items.length) {
    return (
      <p className="max-w-[64ch] text-body leading-relaxed text-ink-2">
        These are worked out overnight from NSE&apos;s results filings. They appear after the financials import (Actions → NSE data →
        financials) and the next nightly run.
      </p>
    );
  }
  const newest = items.reduce((a, b) => (a.v.computedAt > b.v.computedAt ? a : b)).v.computedAt;
  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[70ch] text-body leading-relaxed text-ink-2">
        Three ways of reading what today&apos;s price assumes, each with its formula and inputs so you can redo it on paper. None of
        them is a price target, and they often disagree: that disagreement is the point. Open a stock to see the workings.
      </p>

      <div aria-hidden className="hidden grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] gap-x-4 border-t border-ink pt-2 font-sans text-caption text-ink-3 md:grid">
        <span>Stock</span>
        <span className="text-right">Price</span>
        <span className="text-right">P/E history</span>
        <span className="text-right">Graham number</span>
        <span className="text-right">Price implies</span>
      </div>
      <ul className="flex flex-col border-t border-ink md:border-rule">
        {items.map((it) => (
          <li key={it.key} className="border-b border-rule">
            <details className="group">
              <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 py-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] [&::-webkit-details-marker]:hidden">
                <span className="flex flex-col">
                  <span className="font-semibold">
                    <span aria-hidden className="mr-1.5 inline-block text-ink-3 transition-transform group-open:rotate-90">›</span>
                    {it.name}
                  </span>
                  <span className="font-sans text-caption text-ink-3">
                    {it.symbol} · {pct(it.weight)} of your money
                  </span>
                </span>
                <Cell label="Price" value={it.v.price !== null ? price(it.v.price) : "–"} />
                <Cell label="P/E history" value={it.v.pe.value !== undefined ? price(it.v.pe.value) : "–"} className="hidden md:flex" />
                <Cell label="Graham" value={it.v.graham.value !== undefined ? price(it.v.graham.value) : "–"} className="hidden md:flex" />
                <Cell label="Price implies" value={it.v.reverseDcf.value !== undefined ? `${growthPct(it.v.reverseDcf.value)} a yr` : "–"} className="hidden md:flex" />
              </summary>
              <StockViews v={it.v} />
            </details>
          </li>
        ))}
      </ul>

      {noFilings.length ? (
        <p className="max-w-[70ch] font-sans text-ui text-ink-3">No results filings stored yet for: {noFilings.join(", ")}.</p>
      ) : null}
      <p className="font-sans text-caption leading-relaxed text-ink-3">
        From NSE results filings (XBRL) and NSE closing prices. Worked out {istTime(newest, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} IST.
        Visible to you only. Data and analytics only. Not investment advice.
      </p>
    </div>
  );
}

function Cell({ label, value, className = "flex" }: { label: string; value: string; className?: string }) {
  return (
    <span className={`${className} flex-col items-end text-right`}>
      <span className="font-sans text-caption text-ink-3 md:hidden">{label}</span>
      <span className="figures">{value}</span>
    </span>
  );
}

function StockViews({ v }: { v: Valuation }) {
  const src = latestSource(v);
  const sentence = dcfSentence(v);
  return (
    <div className="flex flex-col gap-4 pb-5 pt-1">
      <div className="grid gap-4 md:grid-cols-3">
        <PeCard v={v} />
        <GrahamCard v={v} />
        <DcfCard v={v} />
      </div>
      {sentence ? <p className="max-w-[70ch] text-body leading-relaxed">{sentence}</p> : null}
      <p className="font-sans text-caption leading-relaxed text-ink-3">
        {v.basis === "standalone" ? "Standalone" : "Consolidated"} figures from NSE results filings
        {src ? (
          <>
            {" "}
            to {monthYear(src.period_end)} (
            <a href={src.url} target="_blank" rel="noreferrer">
              latest filing
            </a>
            )
          </>
        ) : null}
        ; price is the NSE close on {v.priceDate ? new Date(`${v.priceDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "–"}. Per-share figures use today&apos;s share count, so splits and bonuses don&apos;t distort them.
      </p>
    </div>
  );
}

function ViewCard({ title, figure, sub, formula, missing, children, note }: {
  title: string;
  figure?: string;
  sub?: string;
  formula?: string;
  missing?: string;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border border-ink p-4">
      <h3 className="font-sans text-caption font-semibold uppercase tracking-[0.12em] text-ink-3">{title}</h3>
      {missing ? (
        <p className="text-body leading-snug text-ink-2">Not shown: {missing}.</p>
      ) : (
        <>
          <p className="figures text-[24px] font-medium leading-tight">{figure}</p>
          {sub ? <p className="figures font-sans text-ui text-ink-2">{sub}</p> : null}
        </>
      )}
      {children ? <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 font-sans text-caption">{children}</dl> : null}
      {formula && !missing ? <p className="font-sans text-caption text-ink-3">{formula}</p> : null}
      {note ? <p className="font-sans text-caption italic text-ink-3">{note}</p> : null}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  if (v === null) return null;
  return (
    <>
      <dt className="text-ink-3">{k}</dt>
      <dd className="figures text-right text-ink">{v}</dd>
    </>
  );
}

function PeCard({ v }: { v: Valuation }) {
  const i = v.pe.inputs ?? {};
  const eps = num(i.ttm_eps);
  return (
    <ViewCard
      title="P/E history"
      figure={v.pe.value !== undefined ? price(v.pe.value) : undefined}
      sub={v.pe.low !== undefined && v.pe.high !== undefined ? `range ${price(v.pe.low)} – ${price(v.pe.high)}` : undefined}
      formula={v.pe.formula}
      missing={v.pe.missing}
    >
      <Row k={`EPS, 12 months to ${monthYear(i.eps_to as string)}`} v={eps !== null ? price(eps) : null} />
      <Row k={`Median P/E, ${monthYear(i.from as string)} – ${monthYear(i.to as string)}`} v={num(i.median_pe) !== null ? String(num(i.median_pe)) : null} />
      <Row k="25th – 75th percentile" v={num(i.pe_25) !== null ? `${num(i.pe_25)} – ${num(i.pe_75)}` : null} />
      <Row k="P/E today" v={num(i.current_pe) !== null ? String(num(i.current_pe)) : null} />
    </ViewCard>
  );
}

function GrahamCard({ v }: { v: Valuation }) {
  const i = v.graham.inputs ?? {};
  const eps = num(i.ttm_eps);
  const bv = num(i.book_value_per_share);
  return (
    <ViewCard title="Graham number" figure={v.graham.value !== undefined ? price(v.graham.value) : undefined} formula={v.graham.formula} missing={v.graham.missing} note={v.graham.note}>
      <Row k={`EPS, 12 months to ${monthYear(i.eps_to as string)}`} v={eps !== null ? price(eps) : null} />
      <Row k={`Book value a share, ${monthYear(i.book_value_at as string)}`} v={bv !== null ? price(bv) : null} />
    </ViewCard>
  );
}

function DcfCard({ v }: { v: Valuation }) {
  const i = v.reverseDcf.inputs ?? {};
  const fcf = num(i.fcf);
  const mv = num(i.market_value);
  const r = num(i.discount_rate);
  const tg = num(i.terminal_growth);
  return (
    <ViewCard
      title="Reverse DCF"
      figure={v.reverseDcf.value !== undefined ? `${growthPct(v.reverseDcf.value)} a year` : undefined}
      sub={v.reverseDcf.value !== undefined ? "free-cash-flow growth the price implies, for 10 years" : undefined}
      formula={v.reverseDcf.formula}
      missing={v.reverseDcf.missing}
    >
      <Row k={`Free cash flow, ${String(i.fcf_period ?? "")}`} v={fcf !== null ? crore(fcf) : null} />
      <Row k="Market value (price × shares)" v={mv !== null ? crore(mv) : null} />
      <Row k="Discount rate · growth after year 10" v={r !== null && tg !== null ? `${Math.round(r * 1000) / 10}% · ${Math.round(tg * 1000) / 10}%` : null} />
    </ViewCard>
  );
}
