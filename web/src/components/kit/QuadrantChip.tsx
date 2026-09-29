import { QUADRANTS, type Quadrant } from "@/lib/quadrant";

/** A small square in the quadrant colour plus its name. The word carries the meaning, not the colour. */
export function QuadrantChip({ quadrant }: { quadrant: Quadrant }) {
  const q = QUADRANTS[quadrant];
  return (
    <span className={`inline-flex items-center gap-1.5 font-sans text-caption font-semibold ${q.text}`}>
      <span aria-hidden className={`inline-block h-2.5 w-2.5 ${q.bg}`} />
      {q.label}
    </span>
  );
}
