"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/kit/DataTable";
import { QuadrantChip } from "@/components/kit/QuadrantChip";
import { CLOCKWISE, change4w, narrowText, sinceShort, type BenchmarkKey, type IndexRow } from "@/lib/rotationShared";
import { DetailPanel } from "./DetailPanel";

const shareText = (n: number) => `${n >= 9.95 ? Math.round(n) : n.toFixed(1)}%`;
const signed = (n: number, d = 2) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d)}`;
const order = (r: IndexRow) => CLOCKWISE.indexOf(r.now.quadrant) * 1000 - r.now.ratio; // Leading first, strongest first

/** Every sector in one sortable table (stacked rows on phones); a sector's name opens its detail panel. */
export function RotationTable({ rows, benchmark, benchmarkKey, asOf }: { rows: IndexRow[]; benchmark: string; benchmarkKey: BenchmarkKey; asOf: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const openRow = rows.find((r) => r.key === open) ?? null;
  const sorted = useMemo(() => [...rows].sort((a, b) => order(a) - order(b)), [rows]);

  const columns = useMemo<ColumnDef<IndexRow, unknown>[]>(
    () => [
      {
        id: "sector",
        header: "Sector",
        accessorFn: (r) => r.label,
        cell: ({ row: { original: r } }) => (
          <button type="button" onClick={() => setOpen(r.key)} className={`text-left underline decoration-underline underline-offset-2 hover:text-accent ${r.held ? "font-semibold text-ink" : "text-ink-2"}`}>
            {r.label}
          </button>
        ),
      },
      {
        id: "quadrant",
        header: "Quadrant",
        accessorFn: (r) => order(r),
        cell: ({ row: { original: r } }) => (
          <span className="flex flex-col">
            <QuadrantChip quadrant={r.now.quadrant} />
            <span className="font-sans text-caption text-ink-3">{r.nearLine ? "on the line · " : ""}{sinceShort(r)}</span>
          </span>
        ),
      },
      { id: "ratio", header: "Ratio", accessorFn: (r) => r.now.ratio, meta: { align: "right" }, cell: ({ getValue }) => (getValue() as number).toFixed(2) },
      { id: "momentum", header: "Momentum", accessorFn: (r) => r.now.momentum, meta: { align: "right" }, cell: ({ getValue }) => (getValue() as number).toFixed(2) },
      {
        id: "change",
        header: "Ratio, 4 wks",
        accessorFn: (r) => change4w(r) ?? -Infinity,
        meta: { align: "right" },
        cell: ({ row: { original: r } }) => {
          const c = change4w(r);
          return c === null ? <span className="text-ink-3">–</span> : <span className={c > 0 ? "text-gain" : c < 0 ? "text-loss" : ""}>{signed(c)}</span>;
        },
      },
      {
        id: "breadth",
        header: "Above 50-day",
        accessorFn: (r) => r.breadth?.pctAbove ?? -1,
        meta: { align: "right" },
        cell: ({ row: { original: r } }) =>
          r.breadth ? (
            <span title={`${r.breadth.members} stocks counted`}>{Math.round(r.breadth.pctAbove)}%</span>
          ) : (
            <span className="text-ink-3">–</span>
          ),
      },
      {
        id: "note",
        header: "Note",
        enableSorting: false,
        cell: ({ row: { original: r } }) =>
          r.breadth?.narrow ? <span className="font-sans text-caption text-warn">Narrow: {narrowText(r.breadth)}</span> : null,
      },
      {
        id: "money",
        header: "Your money",
        accessorFn: (r) => r.held?.share ?? -1,
        meta: { align: "right" },
        cell: ({ row: { original: r } }) => (r.held ? <span className="font-semibold">{shareText(r.held.share)}</span> : <span className="text-ink-3">–</span>),
      },
    ],
    [],
  );

  return (
    <>
      <div className="hidden md:block">
        <DataTable columns={columns} data={sorted} caption={`Every sector index against the ${benchmark}: quadrant, Ratio, Momentum, 4-week change, breadth and your money`} maxHeight="none" />
      </div>

      {/* Phones: one stacked row per sector. */}
      <ul className="flex flex-col border-t border-ink md:hidden">
        {sorted.map((r) => {
          const c = change4w(r);
          return (
            <li key={r.key} className="border-b border-rule">
              <button type="button" onClick={() => setOpen(r.key)} className="flex w-full flex-col gap-1 py-3 text-left hover:bg-paper-2">
                <span className="flex items-baseline justify-between gap-3">
                  <span className={r.held ? "font-semibold text-ink" : "text-ink-2"}>{r.label}</span>
                  {r.held ? <span className="figures font-semibold">{shareText(r.held.share)}</span> : null}
                </span>
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <QuadrantChip quadrant={r.now.quadrant} />
                  <span className="figures font-sans text-caption text-ink-3">
                    {r.now.ratio.toFixed(2)} / {r.now.momentum.toFixed(2)}
                    {c !== null ? ` · 4 wks ${signed(c)}` : ""}
                    {r.breadth ? ` · ${Math.round(r.breadth.pctAbove)}% above 50-day` : ""}
                  </span>
                </span>
                {r.breadth?.narrow ? <span className="font-sans text-caption text-warn">Narrow: {narrowText(r.breadth)}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>

      {openRow ? <DetailPanel row={openRow} benchmark={benchmark} benchmarkKey={benchmarkKey} asOf={asOf} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
