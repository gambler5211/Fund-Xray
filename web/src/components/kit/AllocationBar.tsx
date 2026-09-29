import { QUADRANTS, type Quadrant } from "@/lib/quadrant";
import { pct } from "@/lib/format";

export type AllocationPart = { quadrant: Quadrant; share: number };

/**
 * One row of "where the money sits" across the four quadrants.
 * Shares are percentages; they need not add to exactly 100 (widths are used as given).
 * Use muted for the benchmark row so the user's own bar reads first.
 */
export function AllocationBar({
  label,
  parts,
  muted = false,
}: {
  label: string;
  parts: AllocationPart[];
  muted?: boolean;
}) {
  const spoken = parts
    .filter((p) => p.share > 0)
    .map((p) => `${pct(p.share)} ${QUADRANTS[p.quadrant].label.toLowerCase()}`)
    .join(", ");
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`${label}: ${spoken}`}>
      <span className={`w-[72px] shrink-0 font-sans text-caption ${muted ? "text-ink-3" : "font-semibold"}`}>{label}</span>
      <div className={`flex h-[18px] flex-1 gap-0.5 ${muted ? "opacity-55" : ""}`} aria-hidden>
        {parts
          .filter((p) => p.share > 0)
          .map((p) => (
            <div key={p.quadrant} className={QUADRANTS[p.quadrant].bg} style={{ width: `${p.share}%` }} />
          ))}
      </div>
    </div>
  );
}

/** The four quadrant names with their colour squares, for under an AllocationBar. */
export function QuadrantLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 font-sans text-caption text-ink-3">
      {(Object.keys(QUADRANTS) as Quadrant[]).map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`inline-block h-2.5 w-2.5 ${QUADRANTS[k].bg}`} />
          {QUADRANTS[k].label}
        </li>
      ))}
    </ul>
  );
}
