import { signedPct } from "@/lib/format";

/**
 * One headline number: a label, the figure, its change and when it was measured.
 * The change carries an arrow and a sign, so it reads without colour.
 */
export function StatTile({
  label,
  value,
  change,
  changeLabel,
  asOf,
}: {
  label: string;
  value: React.ReactNode;
  change?: number; // percent
  changeLabel?: string; // e.g. "today", "vs last week"
  asOf?: string;
}) {
  const tone = change === undefined ? "" : change > 0 ? "text-gain" : change < 0 ? "text-loss" : "text-ink-3";
  const arrow = change === undefined ? "" : change > 0 ? "▲" : change < 0 ? "▼" : "■";
  return (
    <div className="flex flex-col gap-1 border-t-2 border-ink pt-2">
      <span className="font-sans text-caption font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</span>
      <span className="figures text-[34px] font-medium leading-none tracking-[-0.01em] md:text-h2">{value}</span>
      {change !== undefined ? (
        <span className={`figures font-sans text-ui font-semibold ${tone}`}>
          <span aria-hidden className="mr-1 text-[10px]">{arrow}</span>
          {signedPct(change)}
          {changeLabel ? <span className="ml-1 font-normal text-ink-3">{changeLabel}</span> : null}
        </span>
      ) : null}
      {asOf ? <span className="font-sans text-caption text-ink-3">As of {asOf}</span> : null}
    </div>
  );
}
