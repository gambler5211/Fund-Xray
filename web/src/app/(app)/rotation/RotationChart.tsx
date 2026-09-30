"use client";

import { useCallback, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { Chart, type ChartContext } from "@/components/kit/Chart";
import { readToken } from "@/lib/chartTheme";
import { QUADRANTS, type Quadrant } from "@/lib/quadrant";
import { NEUTRAL_BAND, type IndexRow, type Point } from "@/lib/rotationShared";

const TOKEN: Record<Quadrant, string> = { leading: "q-leading", improving: "q-improving", weakening: "q-weakening", lagging: "q-lagging" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const f2 = (n: number) => n.toFixed(2);
const shareText = (n: number) => `${n >= 9.95 ? Math.round(n) : n.toFixed(1)}%`;
const weekOf = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

type Tip = { kind: "now" | "tail"; row: IndexRow; point: Point };

/** Half-width of each axis around 100: the furthest point plus room for labels, at least 3 points. */
function span(values: number[]) {
  const far = Math.max(3, ...values.map((v) => Math.abs(v - 100)));
  return Math.ceil((far + 0.6) * 2) / 2;
}

/** The close-up shows 100 ± this on both axes, where most sectors crowd together. */
const CLOSE_UP = 2;
type View = "whole" | "centre";
const inCentre = (r: IndexRow) => Math.abs(r.now.ratio - 100) <= CLOSE_UP && Math.abs(r.now.momentum - 100) <= CLOSE_UP;
type Tails = "all" | "held";

function tooltip(t: Tip, benchmark: string) {
  const { row, point } = t;
  const q = QUADRANTS[point.quadrant].label;
  const head = `<b>${esc(row.label)}</b> · ${q}`;
  const nums = `Ratio ${f2(point.ratio)} · Momentum ${f2(point.momentum)}`;
  if (t.kind === "tail") return `${head}<br/>Week to ${weekOf(point.date)}<br/>${nums}`;
  const lines = [head, nums];
  if (row.nearLine) lines.push(`On the line: within ${NEUTRAL_BAND} of 100, so the label may still change`);
  if (row.fourWeeksAgo) {
    const p = row.fourWeeksAgo;
    lines.push(`4 weeks ago: ${QUADRANTS[p.quadrant].label}, Ratio ${f2(p.ratio)} · Momentum ${f2(p.momentum)}`);
  }
  if (row.held) {
    const via = row.held.sectors.join(", ");
    lines.push(`${shareText(row.held.share)} of your money (${esc(via)}${row.held.proxy ? ", closest index" : ""})`);
  }
  lines.push(`<span style="opacity:.75">Against the ${esc(benchmark)}, week to ${weekOf(point.date)}</span>`);
  return lines.join("<br/>");
}

export function RotationChart({ rows, benchmark }: { rows: IndexRow[]; benchmark: string }) {
  const anyHeld = rows.some((r) => r.held);
  const crowded = rows.filter(inCentre).length;
  const [view, setView] = useState<View>("whole");
  const [tails, setTails] = useState<Tails>("all");
  const outside = rows.length - crowded;

  const build = useCallback(
    ({ compact }: ChartContext): EChartsCoreOption => {
      const t = readToken;
      const colour = (r: IndexRow) => (r.nearLine ? t("ink-3") : t(TOKEN[r.now.quadrant]));
      const all = rows.flatMap((r) => r.tail);
      const sx = view === "centre" ? CLOSE_UP : span(all.map((p) => p.ratio));
      const sy = view === "centre" ? CLOSE_UP : span(all.map((p) => p.momentum));
      const [x0, x1, y0, y1] = [100 - sx, 100 + sx, 100 - sy, 100 + sy];
      const sans = '"Source Sans 3", system-ui, sans-serif';

      const area = (q: Quadrant, from: [number, number], to: [number, number], position: string) => [
        {
          coord: from,
          itemStyle: { color: t(TOKEN[q]), opacity: 0.07 },
          label: { show: true, position, formatter: QUADRANTS[q].label, color: t(TOKEN[q]), fontFamily: sans, fontSize: 12, fontWeight: 600 },
        },
        { coord: to },
      ];

      // Tails: one line per sector, older weeks fainter.
      const tailRows = rows.filter((r) => tails === "all" || r.held);
      const tailSeries = tailRows.map((r) => ({
        type: "line",
        name: `${r.label} tail`,
        z: 2,
        silent: false,
        symbol: "circle",
        symbolSize: compact ? 3 : 4,
        showSymbol: true,
        clip: true,
        lineStyle: { color: colour(r), width: r.held ? 1.75 : 1, opacity: r.held ? 0.65 : 0.25 },
        data: r.tail.map((p, i, arr) => ({
          value: [p.ratio, p.momentum],
          itemStyle: { color: colour(r), opacity: i === arr.length - 1 ? 0 : (r.held ? 0.3 : 0.15) + (0.5 * i) / Math.max(1, arr.length - 1) },
          tip: { kind: "tail", row: r, point: p } satisfies Tip,
        })),
        tooltip: { show: true },
        emphasis: { disabled: true },
      }));

      const head = (held: boolean) => ({
        type: "scatter",
        name: held ? "Sectors you hold" : "Other sectors",
        z: held ? 5 : 4,
        symbolSize: held ? 13 : 9,
        clip: true,
        labelLayout: held ? { moveOverlap: "shiftY" } : { hideOverlap: true },
        data: rows
          .filter((r) => !!r.held === held)
          .map((r) => ({
            value: [r.now.ratio, r.now.momentum],
            name: r.label,
            itemStyle: { color: colour(r), borderColor: t("paper"), borderWidth: 1.5 },
            label: {
              // On a phone's whole map the centre is too tight for labels; the close-up names them.
              show: compact ? held && (view === "centre" || !inCentre(r)) : true,
              // Labels near the right edge go on the left of the dot so they aren't cut off.
              position: r.now.ratio > 100 + sx * 0.55 ? "left" : "right",
              distance: 6,
              formatter: held ? `${r.label} · ${shareText(r.held!.share)}` : r.label,
              color: held ? t("ink") : t("ink-3"),
              fontFamily: sans,
              fontSize: held ? 13 : 12,
              fontWeight: held ? 700 : 400,
            },
            tip: { kind: "now", row: r, point: r.now } satisfies Tip,
          })),
      });

      return {
        animation: false,
        grid: { left: compact ? 36 : 48, right: compact ? 28 : 24, top: 12, bottom: compact ? 40 : 48, containLabel: false },
        tooltip: {
          trigger: "item",
          confine: true,
          formatter: (p: { data?: { tip?: Tip } }) => (p.data?.tip ? tooltip(p.data.tip, benchmark) : ""),
        },
        xAxis: {
          type: "value",
          min: x0,
          max: x1,
          name: compact ? "Ratio →" : `Ratio: strength against the ${benchmark} →`,
          nameLocation: "middle",
          nameGap: compact ? 24 : 30,
          splitLine: { show: false },
          axisLabel: { formatter: (v: number) => (Number.isInteger(v) ? String(v) : "") },
        },
        yAxis: {
          type: "value",
          min: y0,
          max: y1,
          name: compact ? "Momentum →" : "Momentum: gaining or losing pace →",
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
          ...tailSeries,
          head(false),
          head(true),
        ],
      };
    },
    [rows, benchmark, view, tails],
  );

  const held = rows.filter((r) => r.held).map((r) => r.label);
  const label = `Rotation quadrants against the ${benchmark}: ${rows.length} sector indices with 8-week tails${held.length ? `; you hold ${held.join(", ")}` : ""}. The list below the chart has every sector and its quadrant.`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-sans text-ui">
        <Toggle
          label="View"
          value={view}
          onChange={setView}
          options={[
            ["whole", "Whole map"],
            ["centre", `Close-up (${crowded} near the centre)`],
          ]}
        />
        {anyHeld ? (
          <Toggle
            label="Tails"
            value={tails}
            onChange={setTails}
            options={[
              ["all", "Every sector"],
              ["held", "Yours only"],
            ]}
          />
        ) : null}
      </div>
      <Chart option={build} label={label} className="aspect-square max-h-[640px] md:aspect-[4/3]" />
      {view === "whole" && crowded > 3 ? (
        <p className="font-sans text-caption text-ink-3">
          Tap or hover a dot for its numbers. {crowded} sectors sit within {CLOSE_UP} points of the centre; the close-up spreads them out.
        </p>
      ) : null}
      {view === "centre" && outside ? (
        <p className="font-sans text-caption text-ink-3">
          Close-up of 100 ± {CLOSE_UP} on both axes; {outside} {outside === 1 ? "sector sits" : "sectors sit"} outside it. Switch to the whole map to see them.
        </p>
      ) : null}
    </div>
  );
}

function Toggle<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <span className="mr-1 text-caption text-ink-3">{label}</span>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`inline-flex h-11 items-center border px-3 md:h-9 ${v === value ? "border-ink text-ink" : "border-rule text-ink-3 hover:bg-paper-2"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
