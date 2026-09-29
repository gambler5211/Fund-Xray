import { EmptyState, Kicker } from "@/components/Section";

export const metadata = { title: "Portfolio · Fund X-Ray" };

export default function PortfolioPage() {
  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-3 border-b border-ink py-7">
        <Kicker>Your holdings</Kicker>
        <h1 className="text-[30px] font-medium leading-[1.12] tracking-[-0.015em] md:text-h2">No holdings yet</h1>
        <p className="max-w-[60ch] text-body leading-relaxed text-ink-2 md:text-lead">
          Holdings are pulled from Kite on every sync; nothing about your portfolio is stored in code.
        </p>
      </section>
      <div className="py-7">
        <EmptyState
          title="Connect Kite to load your portfolio"
          body="Once connected, this page shows your value, today's and total P/L, where the money sits by sector, and a holdings table set like a stock-listings page."
        />
      </div>
    </div>
  );
}
