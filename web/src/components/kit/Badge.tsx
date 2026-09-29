import { QUADRANTS, type Quadrant } from "@/lib/quadrant";

type Tone = "gain" | "loss" | "neutral";

const TONE: Record<Tone, string> = {
  gain: "border-gain text-gain",
  loss: "border-loss text-loss",
  neutral: "border-ink-3 text-ink-3",
};
const QTONE: Record<Quadrant, string> = {
  leading: "border-q-leading text-q-leading",
  improving: "border-q-improving text-q-improving",
  weakening: "border-q-weakening text-q-weakening",
  lagging: "border-q-lagging text-q-lagging",
};

const BASE = "inline-flex items-center border px-1.5 py-px font-sans text-[11px] font-semibold uppercase tracking-[0.1em]";

/** A short status word in a thin box. The word carries the meaning; colour only backs it up. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`${BASE} ${TONE[tone]}`}>{children}</span>;
}

/** A badge named after a rotation quadrant, e.g. WEAKENING. */
export function QuadrantBadge({ quadrant }: { quadrant: Quadrant }) {
  return <span className={`${BASE} ${QTONE[quadrant]}`}>{QUADRANTS[quadrant].label}</span>;
}
