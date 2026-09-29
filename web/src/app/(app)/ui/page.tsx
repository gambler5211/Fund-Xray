import { Kicker } from "@/components/Section";

export const metadata = { title: "Design tokens · Fund X-Ray", robots: { index: false } };

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
    </div>
  );
}
