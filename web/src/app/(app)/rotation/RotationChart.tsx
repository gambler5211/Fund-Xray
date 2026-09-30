"use client";

import { useCallback, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { Chart, type ChartContext } from "@/components/kit/Chart";
import { readToken } from "@/lib/chartTheme";
import { QUADRANTS, type Quadrant } from "@/lib/quadrant";
import { NEUTRAL_BAND, since, standing, type IndexRow, type Point } from "@/lib/rotationShared";

const TOKEN: Record<Quadrant, string> = { leading: "q-leading", improving: "q-improving", weakening: "q-weakening", lagging: "q-lagging" };
/** What each corner means, in words, next to its name. */
const CORNER: Record<Quadrant, string> = {
  leading: "ahead and gaining",
  weakening: "ahead but slowing",
  lagging: "behind and slipping",
  improving: "behind but recovering",
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const f2 = (n: number) => n.toFixed(2);
const shareText = (n: number) => `${n >= 9.95 ? Math.round(n) : n.toFixed(1)}%`;
const weekOf = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** The close-up shows 100 ± this on both axes, where most sectors crowd together. */
const CLOSE_UP = 2;
type View = "whole" | "centre";
const inCentre = (r: IndexRow) => Math.abs(r.now.ratio - 100) <= CLOSE_UP && Math.abs(r.now.momentum - 100) <= CLOSE_UP;

type Tip = { kind: "now" | "tail"; key: string; point: Point };

/** Half-width of each axis around 100: the furthest dot plus room, at least 3 points. */
function span(values: number[]) {
  const far = Math.max(3, ...values.map((v) => Math.abs(v - 100)));
  return Math.ceil((far + 0.6) * 2) / 2;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
type Place = "right" | "left" | "top" | "bottom";

/**
 * Where to put each label so none overlap: try right, left, above, below in turn, against the
 * labels already placed and every dot. Pixel sizes are estimates from the chart's size.
 */
function placeLabels(items: { key: string; x: number; y: number; text: string }[], w: number, h: number, dots: { x: number; y: number }[]) {
  const placed: Box[] = [];
  const out = new Map<string, Place | null>();
  const dotBoxes = dots.map((d) => ({ x0: d.x - 5, y0: d.y - 5, x1: d.x + 5, y1: d.y + 5 }));
  for (const it of [...items].sort((a, b) => a.y - b.y)) {
    const tw = it.text.length * 6.6 + 4;
    const th = 16;
    const cand: Record<Place, Box> = {
      right: { x0: it.x + 9, y0: it.y - th / 2, x1: it.x + 9 + tw, y1: it.y + th / 2 },
      left: { x0: it.x - 9 - tw, y0: it.y - th / 2, x1: it.x - 9, y1: it.y + th / 2 },
      top: { x0: it.x - tw / 2, y0: it.y - 10 - th, x1: it.x + tw / 2, y1: it.y - 10 },
      bottom: { x0: it.x - tw / 2, y0: it.y + 10, x1: it.x + tw / 2, y1: it.y + 10 + th },
    };
    const own = { x0: it.x - 6, y0: it.y - 6, x1: it.x + 6, y1: it.y + 6 };
    const fits = (b: Box) => b.x0 >= 0 && b.x1 <= w && b.y0 >= 0 && b.y1 <= h;
    const free = (b: Box) => !placed.some((p) => hits(p, b)) && !dotBoxes.some((d) => !hits(d, own) && hits(d, b));
    const pick = (["right", "left", "top", "bottom"] as Place[]).find((p) => fits(cand[p]) && free(cand[p])) ?? null;
    if (pick) placed.push(cand[pick]);
    out.set(it.key, pick);
  }
  return out;
}

function tooltip(t: Tip, row: IndexRow, benchmark: string) {
  const { point } = t;
  const head = `<b>${esc(row.label)}</b> · ${QUADRANTS[point.quadrant].label}`;
  if (t.kind === "tail") return `${head}<br/>Week to ${weekOf(point.date)}<br/>Ratio ${f2(point.ratio)} · Momentum ${f2(point.momentum)}`;
  const lines = [head, `${esc(standing(row, benchmark))}, ${since(row)}`, `Ratio ${f2(point.ratio)} · Momentum ${f2(point.momentum)}`];
  if (row.nearLine) lines.push(`On the line: within ${NEUTRAL_BAND} of 100, so the label may still change`);
  if (row.held) lines.push(`${shareText(row.held.share)} of your money (${esc(row.held.sectors.join(", "))}${row.held.proxy ? ", closest index" : ""})`);
  lines.push(`<span style="opacity:.75">Tap the dot to see its last 8 weeks</span>`);
  return lines.join("<br/>");
}

export function RotationChart({ rows, benchmark }: { rows: IndexRow[]; benchmark: string }) {
  const crowded = rows.filter(inCentre).length;
  const [view, setView] = useState<View>("whole");
  const [picked, setPicked] = useState<string | null>(null);
  const pickedRow = rows.find((r) => r.key === picked) ?? null;
  const outside = rows.length - crowded;

  const build = useCallback(
    ({ compact, width, height: boxHeight }: ChartContext): EChartsCoreOption => {
      const t = readToken;
      const colour = (r: IndexRow) => (r.nearLine ? t("ink-3") : t(TOKEN[r.now.quadrant]));
      const heads = rows.map((r) => r.now);
      const sel = rows.find((r) => r.key === picked);
      const extent = sel ? [...heads, ...sel.tail] : heads;
      const sx = view === "centre" ? CLOSE_UP : span(extent.map((p) => p.ratio));
      const sy = view === "centre" ? CLOSE_UP : span(extent.map((p) => p.momentum));
      const [x0, x1, y0, y1] = [100 - sx, 100 + sx, 100 - sy, 100 + sy];
      const sans = '"Source Sans 3", system-ui, sans-serif';

      // Plot area in pixels, to place labels (matches grid and the container's aspect ratio).
      const grid = { left: compact ? 36 : 48, right: compact ? 16 : 24, top: 12, bottom: compact ? 40 : 48 };
      const height = boxHeight || Math.min(640, compact ? width : (width * 3) / 4);
      const pw = width - grid.left - grid.right;
      const ph = height - grid.top - grid.bottom;
      const px = (r: number) => ((r - x0) / (x1 - x0)) * pw;
      const py = (m: number) => ((y1 - m) / (y1 - y0)) * ph;
      const visible = rows.filter((r) => r.now.ratio >= x0 && r.now.ratio <= x1 && r.now.momentum >= y0 && r.now.momentum <= y1);

      // Labels: your sectors and the picked one always; others only in the close-up on wider screens.
      const labelled = visible.filter((r) => r.held || r.key === picked || (view === "centre" && !compact));
      const text = (r: IndexRow) => (r.held ? `${r.label} · ${shareText(r.held.share)}` : r.label);
      const places = placeLabels(
        labelled.map((r) => ({ key: r.key, x: px(r.now.ratio), y: py(r.now.momentum), text: text(r) })),
        pw,
        ph,
        visible.map((r) => ({ x: px(r.now.ratio), y: py(r.now.momentum) })),
      );

      const area = (q: Quadrant, from: [number, number], to: [number, number], position: string) => [
        {
          coord: from,
          itemStyle: { color: t(TOKEN[q]), opacity: 0.07 },
          label: {
            show: true,
            position,
            formatter: compact ? `{b|${QUADRANTS[q].label}}\n{s|${CORNER[q]}}` : `{b|${QUADRANTS[q].label}} {s|${CORNER[q]}}`,
            rich: {
              b: { color: t(TOKEN[q]), fontFamily: sans, fontSize: 12, fontWeight: 600, lineHeight: 15 },
              s: { color: t(TOKEN[q]), fontFamily: sans, fontSize: 12, lineHeight: 15, opacity: 0.85 },
            },
          },
        },
        { coord: to },
      ];

      const trail = sel
        ? [
            {
              type: "line",
              name: `${sel.label}, last 8 weeks`,
              z: 3,
              clip: true,
              symbol: "circle",
              symbolSize: 6,
              lineStyle: { color: colour(sel), width: 2, opacity: 0.8 },
              data: sel.tail.slice(0, -1).map((p, i, arr) => ({
                value: [p.ratio, p.momentum],
                itemStyle: { color: colour(sel), opacity: 0.35 + (0.5 * i) / Math.max(1, arr.length - 1) },
                label: i === 0 ? { show: true, position: "bottom", formatter: `${weekOf(p.date)}`, color: t("ink-3"), fontFamily: sans, fontSize: 11 } : { show: false },
                tip: { kind: "tail", key: sel.key, point: p } as Tip,
              })).concat([{ value: [sel.now.ratio, sel.now.momentum], itemStyle: { color: colour(sel), opacity: 0 }, label: { show: false }, tip: { kind: "now", key: sel.key, point: sel.now } as Tip }]),
            },
          ]
        : [];

      const dots = {
        type: "scatter",
        name: "Sectors",
        z: 5,
        clip: true,
        data: rows.map((r) => {
          const place = places.get(r.key);
          const dim = sel && r.key !== sel.key;
          return {
            value: [r.now.ratio, r.now.momentum],
            name: r.label,
            symbolSize: r.held ? 13 : 9,
            itemStyle: {
              color: colour(r),
              opacity: dim ? 0.35 : 1,
              borderColor: r.key === picked ? t("ink") : t("paper"),
              borderWidth: r.key === picked ? 2 : 1.5,
            },
            label: {
              show: !!place,
              position: place ?? "right",
              distance: 7,
              formatter: text(r),
              color: r.held || r.key === picked ? t("ink") : t("ink-3"),
              opacity: dim ? 0.5 : 1,
              fontFamily: sans,
              fontSize: r.held ? 13 : 12,
              fontWeight: r.held ? 700 : 400,
            },
            tip: { kind: "now", key: r.key, point: r.now } satisfies Tip,
          };
        }),
      };

      return {
        animation: false,
        grid,
        tooltip: {
          trigger: "item",
          confine: true,
          formatter: (p: { data?: { tip?: Tip } }) => {
            const tip = p.data?.tip;
            const row = tip && rows.find((r) => r.key === tip.key);
            return tip && row ? tooltip(tip, row, benchmark) : "";
          },
        },
        xAxis: {
          type: "value",
          min: x0,
          max: x1,
          name: compact ? "← behind   Ratio   ahead →" : `← behind the ${benchmark}        Ratio        ahead of the ${benchmark} →`,
          nameLocation: "middle",
          nameGap: compact ? 24 : 30,
          splitLine: { show: false },
          axisLabel: { formatter: (v: number) => (Number.isInteger(v) ? String(v) : "") },
        },
        yAxis: {
          type: "value",
          min: y0,
          max: y1,
          name: compact ? "← slowing   Momentum   gaining →" : "← losing pace        Momentum        gaining pace →",
          nameLocation: "middle",
          nameGap: compact ? 26 : 34,
          splitLine: { show: false },
          axisLabel: { formatter: (v: number) => (Number.isInteger(v) ? String(v) : "") },
        },
        series: [
          {
            type: "scatter",
            name: "quadrants",
            silent: true,
            data: [],
            markArea: {
              silent: true,
              data: [
                area("leading", [100, 100], [x1, y1], "insideTopRight"),
                area("weakening", [100, y0], [x1, 100], "insideBottomRight"),
                area("lagging", [x0, y0], [100, 100], "insideBottomLeft"),
                area("improving", [x0, 100], [100, y1], "insideTopLeft"),
              ],
            },
            markLine: {
              silent: true,
              symbol: "none",
              label: { show: false },
              lineStyle: { color: t("ink-3"), width: 1, type: "solid" },
              data: [{ xAxis: 100 }, { yAxis: 100 }],
            },
          },
          ...trail,
          dots,
        ],
      };
    },
    [rows, benchmark, view, picked],
  );

  const onClick = useCallback((d: unknown) => {
    const tip = (d as { tip?: Tip } | null)?.tip;
    setPicked((cur) => (tip ? (tip.key === cur && tip.kind === "now" ? null : tip.key) : null));
  }, []);

  const held = rows.filter((r) => r.held).map((r) => r.label);
  const label = `Rotation quadrants against the ${benchmark}: ${rows.length} sector indices${held.length ? `; you hold ${held.join(", ")}` : ""}. The lists on this page describe every sector in words.`;
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="View" className="flex flex-wrap items-center gap-1 font-sans text-ui">
        <span className="mr-1 text-caption text-ink-3">View</span>
        {(
          [
            ["whole", "Whole map"],
            ["centre", `Close-up (${crowded} near the centre)`],
          ] as [View, string][]
        ).map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === view}
            onClick={() => setView(v)}
            className={`inline-flex h-11 items-center border px-3 md:h-9 ${v === view ? "border-ink text-ink" : "border-rule text-ink-3 hover:bg-paper-2"}`}
          >
            {text}
          </button>
        ))}
      </div>
      <Chart option={build} onClick={onClick} label={label} className="aspect-square max-h-[640px] md:aspect-[4/3]" />
      <p className="min-h-[2lh] font-sans text-caption leading-relaxed text-ink-3 md:min-h-[1lh]" aria-live="polite">
        {pickedRow ? (
          <>
            {pickedRow.label}&apos;s path over the last 8 weeks, starting from the dated dot. Now {standing(pickedRow, benchmark)}; {since(pickedRow) === "new this week" ? `new to ${QUADRANTS[pickedRow.now.quadrant].label} this week` : `${QUADRANTS[pickedRow.now.quadrant].label} ${since(pickedRow)}`}.{" "}
            <button type="button" className="underline decoration-underline underline-offset-2 hover:text-ink" onClick={() => setPicked(null)}>
              Clear
            </button>
          </>
        ) : view === "centre" && outside ? (
          `Close-up of 100 ± ${CLOSE_UP} on both axes; ${outside} ${outside === 1 ? "sector sits" : "sectors sit"} outside it.`
        ) : (
          "Tap a dot to see where it has been over the last 8 weeks. Bold dots are sectors you hold; grey ones sit on a line, so their label can still change."
        )}
      </p>
    </div>
  );
}
