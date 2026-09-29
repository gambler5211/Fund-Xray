"use client";

// Sample-data demos for the /ui review page. Client-side because table columns and chart options hold functions.

import type { ColumnDef } from "@tanstack/react-table";
import { Chart } from "@/components/kit/Chart";
import { DataTable } from "@/components/kit/DataTable";
import { Change, Rupees, Share } from "@/components/kit/Figures";
import { QuadrantChip } from "@/components/kit/QuadrantChip";
import type { Quadrant } from "@/lib/quadrant";
import { readToken } from "@/lib/chartTheme";

type Row = { name: string; sector: string; quadrant: Quadrant; value: number; day: number; weight: number };

const ROWS: Row[] = [
  { name: "NTPC", sector: "Power", quadrant: "leading", value: 40572, day: 0.84, weight: 14.0 },
  { name: "Coal India", sector: "Metals & Mining", quadrant: "improving", value: 30916, day: -0.71, weight: 10.7 },
  { name: "KPI Green Energy", sector: "Power", quadrant: "weakening", value: 21648, day: -2.4, weight: 7.5 },
  { name: "Tata Power", sector: "Power", quadrant: "leading", value: 19870, day: 1.12, weight: 6.9 },
  { name: "Bharat Electronics", sector: "Capital Goods", quadrant: "leading", value: 18240, day: 0.35, weight: 6.3 },
  { name: "IRFC", sector: "Financial Services", quadrant: "lagging", value: 15310, day: -1.05, weight: 5.3 },
  { name: "Suzlon Energy", sector: "Capital Goods", quadrant: "weakening", value: 12980, day: 2.41, weight: 4.5 },
  { name: "HUDCO", sector: "Financial Services", quadrant: "lagging", value: 11020, day: -0.2, weight: 3.8 },
];

const COLUMNS: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Stock", cell: (c) => <span className="font-semibold">{c.getValue() as string}</span> },
  { accessorKey: "sector", header: "Sector", cell: (c) => <span className="font-sans text-ui text-ink-2">{c.getValue() as string}</span> },
  { accessorKey: "quadrant", header: "Strength", cell: (c) => <QuadrantChip quadrant={c.getValue() as Quadrant} /> },
  { accessorKey: "value", header: "Value", meta: { align: "right" }, cell: (c) => <Rupees value={c.getValue() as number} /> },
  { accessorKey: "day", header: "Today", meta: { align: "right" }, cell: (c) => <Change value={c.getValue() as number} className="font-sans text-ui" /> },
  { accessorKey: "weight", header: "Share", meta: { align: "right" }, cell: (c) => <Share value={c.getValue() as number} className="font-sans text-ui" /> },
];

export function DemoTable() {
  return <DataTable columns={COLUMNS} data={ROWS} caption="Sample holdings" initialSort={[{ id: "value", desc: true }]} maxHeight="20rem" />;
}

// Relative strength of three sectors against the Nifty 500 over 12 weeks (sample numbers).
const WEEKS = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);
const OPTION = {
  grid: { left: 40, right: 16, top: 36, bottom: 28 },
  legend: { top: 0, left: 0 },
  tooltip: { trigger: "axis" },
  xAxis: { type: "category", data: WEEKS, boundaryGap: false },
  yAxis: { type: "value", min: 94, max: 106, interval: 3 },
  series: [
    { name: "Power", type: "line", data: [99, 100, 101, 102, 102.5, 103.4, 104, 104.2, 104.8, 105, 104.6, 105.2] },
    { name: "Capital Goods", type: "line", data: [97, 97.4, 98, 98.6, 99.1, 99.8, 100.2, 100.9, 101.2, 101.8, 102.1, 102.6] },
    { name: "Financial Services", type: "line", data: [103, 102.6, 102.1, 101.5, 101, 100.4, 99.7, 99.1, 98.6, 98.2, 97.5, 97.1] },
  ],
};

export function DemoChart() {
  // Draw the 100 line (the benchmark) in the ink-3 token.
  const option = {
    ...OPTION,
    series: OPTION.series.map((s, i) =>
      i === 0
        ? { ...s, markLine: { silent: true, symbol: "none", data: [{ yAxis: 100 }], label: { formatter: "Nifty 500 = 100", position: "insideStartTop" }, lineStyle: { type: "dashed", color: typeof window === "undefined" ? undefined : readToken("ink-3") } } }
        : s,
    ),
  };
  return <Chart option={option} height={260} label="Sample chart: Power and Capital Goods rising above the Nifty 500 over 12 weeks, Financial Services falling below it." />;
}
