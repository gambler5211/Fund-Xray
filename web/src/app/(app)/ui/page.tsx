import { KitePill } from "@/components/KitePill";
import { KiteCard } from "@/components/KiteCard";
import { SettingsForm } from "../settings/SettingsForm";
import { AccountCard } from "../settings/AccountCard";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { Kicker, EmptyState, SectionHeader } from "@/components/Section";
import { AllocationBar, QuadrantLegend } from "@/components/kit/AllocationBar";
import { Button, LinkButton } from "@/components/kit/Button";
import { Change, Rupees, Share } from "@/components/kit/Figures";
import { HoldingRow, HoldingsHeader, type Holding } from "@/components/kit/HoldingRow";
import { QuadrantChip } from "@/components/kit/QuadrantChip";
import { ErrorState, HoldingsSkeleton, SampleLabel, Skeleton } from "@/components/kit/States";
import { QUADRANTS, QUADRANT_ORDER } from "@/lib/quadrant";
import { Badge, QuadrantBadge } from "@/components/kit/Badge";
import { Card } from "@/components/kit/Card";
import { StatTile } from "@/components/kit/StatTile";
import { DemoChart, DemoTable } from "./Demos";

export const metadata = { title: "Design kit · Fund X-Ray", robots: { index: false } };

const COLOURS = [
  ["paper", "bg-paper"],
  ["paper-2", "bg-paper-2"],
  ["ink", "bg-ink"],
  ["ink-2", "bg-ink-2"],
  ["ink-3", "bg-ink-3"],
  ["rule", "bg-rule"],
  ["accent", "bg-accent"],
  ["gain", "bg-gain"],
  ["loss", "bg-loss"],
  ["q-leading", "bg-q-leading"],
  ["q-improving", "bg-q-improving"],
  ["q-weakening", "bg-q-weakening"],
  ["q-lagging", "bg-q-lagging"],
] as const;

const TYPE = [
  ["h1 · 56", "text-h1 font-semibold"],
  ["h2 · 40", "text-h2 font-medium"],
  ["h3 · 28", "text-h3 font-medium"],
  ["lead · 20", "text-lead"],
  ["body · 16", "text-body"],
  ["ui · 14", "text-ui font-sans"],
  ["caption · 12", "text-caption font-sans"],
] as const;

const SAMPLE: Holding[] = [
  { name: "NTPC", sector: "Power", quadrant: "leading", value: 40572, dayChangePct: 0.84, weight: 14.0 },
  { name: "Coal India", sector: "Metals & Mining", quadrant: "improving", value: 30916, dayChangePct: -0.71, weight: 10.7 },
  { name: "KPI Green Energy", sector: "Power", quadrant: "weakening", value: 21648, dayChangePct: -2.4, weight: 7.5 },
  { name: "A very long company name that has to be cut off politely", sector: "Capital Goods", quadrant: "lagging", value: 18240, dayChangePct: 0, weight: 6.3 },
];

/** Hidden review page: every token in the current theme. Switch day/night in the masthead to check both. */
export default function TokensPage() {
  return (
    <div className="flex flex-col gap-10 py-7">
      <section className="flex flex-col gap-4">
        <Kicker>Colours</Kicker>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {COLOURS.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-2">
              <div className={`h-14 border border-rule ${cls}`} />
              <span className="font-sans text-caption text-ink-3">{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <Kicker>Type scale</Kicker>
        {TYPE.map(([name, cls]) => (
          <div key={name} className="flex items-baseline gap-6 border-b border-rule pb-2">
            <span className="w-28 shrink-0 font-sans text-caption text-ink-3">{name}</span>
            <span className={`${cls} leading-tight`}>Nearly two-fifths of your money</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <Kicker>Figures</Kicker>
        <div className="figures flex flex-col gap-1 text-body">
          <div className="flex justify-between border-b border-rule pb-1"><span>NTPC</span><span>₹40,572 <span className="text-gain">+0.84%</span></span></div>
          <div className="flex justify-between border-b border-rule pb-1"><span>Coal India</span><span>₹30,916 <span className="text-loss">−0.71%</span></span></div>
          <div className="flex justify-between"><span>KPI Green Energy</span><span>₹21,648 <span className="text-loss">−2.40%</span></span></div>
        </div>
        <p className="font-sans text-caption text-ink-3">Sample figures to check tabular alignment.</p>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Figures, kit version" aside={<SampleLabel />} />
        <dl className="flex flex-col gap-1 text-body">
          {[
            ["Rupees, full", <Rupees key="a" value={289167} />],
            ["Rupees, short (lakh)", <Rupees key="b" value={289167} short />],
            ["Rupees, short (crore)", <Rupees key="c" value={12400000} short />],
            ["Gain", <Change key="d" value={2.29} />],
            ["Loss", <Change key="e" value={-0.71} />],
            ["Flat", <Change key="f" value={0} />],
            ["Share of portfolio", <Share key="g" value={38.9} />],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between border-b border-rule pb-1">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Quadrants" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUADRANT_ORDER.map((k) => (
            <div key={k} className="flex flex-col gap-1 border-t-2 border-ink pt-2">
              <QuadrantChip quadrant={k} />
              <span className="font-sans text-caption text-ink-3">{QUADRANTS[k].blurb}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Allocation bar" aside={<SampleLabel />} />
        <AllocationBar
          label="You"
          parts={[
            { quadrant: "leading", share: 43.6 },
            { quadrant: "improving", share: 17.5 },
            { quadrant: "weakening", share: 38.9 },
          ]}
        />
        <AllocationBar
          label="Nifty 500"
          muted
          parts={[
            { quadrant: "leading", share: 41 },
            { quadrant: "improving", share: 35 },
            { quadrant: "weakening", share: 15 },
            { quadrant: "lagging", share: 9 },
          ]}
        />
        <QuadrantLegend />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Holdings" aside={<SampleLabel />} />
        <HoldingsHeader />
        <ul>
          {SAMPLE.map((h) => (
            <HoldingRow key={h.name} h={h} />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Stat tiles" aside={<SampleLabel />} />
        <div className="grid gap-6 sm:grid-cols-3">
          <StatTile label="Portfolio value" value={<Rupees value={2891670} short />} change={0.62} changeLabel="today" asOf="29 Sep, 3:30 pm" />
          <StatTile label="In fading sectors" value="38.9%" change={4.1} changeLabel="vs last week" asOf="Saturday edition" />
          <StatTile label="Effective bets" value="3.2" asOf="58 stocks" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Badges" />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gain">Up</Badge>
          <Badge tone="loss">Down</Badge>
          <Badge>Unmapped</Badge>
          {QUADRANT_ORDER.map((k) => (
            <QuadrantBadge key={k} quadrant={k} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Card (for asides)" />
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="How to read this" actions={<Button variant="secondary">Hide</Button>} footer="Updated every Saturday">
            A sector is Leading when it beats the Nifty 500 and the gap is widening.
          </Card>
          <Card>A card without a header, for a short note.</Card>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Sortable table" aside={<SampleLabel />} />
        <p className="font-sans text-caption text-ink-3">Click a column title to sort. The header stays in place while the rows scroll.</p>
        <DemoTable />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Chart theme" aside={<SampleLabel />} />
        <p className="font-sans text-caption text-ink-3">Colours come from the same tokens; switch Day / Night to see it follow.</p>
        <DemoChart />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Buttons" />
        <div className="flex flex-wrap items-center gap-3">
          <Button>Connect Zerodha</Button>
          <Button variant="secondary">Refresh</Button>
          <Button disabled>Not yet</Button>
          <LinkButton href="/settings" variant="secondary">Open settings</LinkButton>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Loading, empty and error" />
        <HoldingsSkeleton rows={3} />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-full max-w-[60ch]" />
        </div>
        <EmptyState
          title="No holdings yet"
          body="Connect Zerodha and your holdings appear here, grouped by sector."
          action={<Button>Connect Zerodha</Button>}
        />
        <ErrorState
          title="We couldn't reach Zerodha"
          body="Your saved holdings are still here, last updated yesterday. Reconnect to refresh them."
          action={<Button variant="secondary">Reconnect</Button>}
        />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Kite status" aside={<SampleLabel />} />
        <div className="flex flex-wrap gap-8 font-sans text-[13px] text-ink-3">
          <KitePill status={{ state: "connected", kiteUserId: "AB1234", connectedAt: new Date(Date.now() - 3 * 3600e3).toISOString(), expiresAt: new Date(Date.now() + 8 * 3600e3).toISOString() }} />
          <KitePill status={{ state: "connected", kiteUserId: "AB1234", connectedAt: new Date(Date.now() - 20 * 3600e3).toISOString(), expiresAt: new Date(Date.now() + 40 * 60e3).toISOString() }} />
          <KitePill status={{ state: "expired", kiteUserId: "AB1234", expiresAt: new Date(Date.now() - 3600e3).toISOString() }} />
          <KitePill status={{ state: "never" }} />
        </div>
        <KiteCard status={{ state: "never" }} />
        <KiteCard status={{ state: "expired" }} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Settings form" aside={<SampleLabel>Demo, saves nowhere</SampleLabel>} />
        <SettingsForm demo initial={DEFAULT_SETTINGS} />
        <div className="md:max-w-[calc(50%-16px)]">
          <AccountCard demo name="Sample Reader" email="reader@example.com" kite={{ state: "connected", kiteUserId: "AB1234", connectedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 8 * 3600e3).toISOString() }} />
        </div>
      </section>
    </div>
  );
}
