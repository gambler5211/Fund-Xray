/** The four rotation quadrants. Class names are written out in full so Tailwind can see them. */
export type Quadrant = "leading" | "improving" | "weakening" | "lagging";

export const QUADRANTS: Record<Quadrant, { label: string; blurb: string; text: string; bg: string }> = {
  leading: { label: "Leading", blurb: "Strong, and getting stronger", text: "text-q-leading", bg: "bg-q-leading" },
  improving: { label: "Improving", blurb: "Weak, but turning up", text: "text-q-improving", bg: "bg-q-improving" },
  weakening: { label: "Weakening", blurb: "Strong, but losing pace", text: "text-q-weakening", bg: "bg-q-weakening" },
  lagging: { label: "Lagging", blurb: "Weak, and getting weaker", text: "text-q-lagging", bg: "bg-q-lagging" },
};

export const QUADRANT_ORDER: Quadrant[] = ["leading", "improving", "weakening", "lagging"];
