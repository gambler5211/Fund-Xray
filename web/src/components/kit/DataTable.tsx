"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

// Lets a column say it holds numbers, so its header and cells align right.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    align?: "left" | "right";
  }
}

/**
 * Sortable table on TanStack Table.
 * Click a header to sort; click again to reverse. The header stays put while the body scrolls.
 * Numeric columns: set meta: { align: "right" } in the column definition.
 */
export function DataTable<T>({
  columns,
  data,
  caption,
  initialSort = [],
  maxHeight = "28rem",
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  caption: string; // read by screen readers; say what the table lists
  initialSort?: SortingState;
  maxHeight?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-auto border-y border-ink" style={{ maxHeight }}>
      <table className="w-full min-w-[560px] border-collapse text-body">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-paper">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b-2 border-ink">
              {hg.headers.map((header) => {
                const right = header.column.columnDef.meta?.align === "right";
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                    className={`px-2 py-2 font-sans text-caption font-semibold text-ink-3 ${right ? "text-right" : "text-left"}`}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={`inline-flex items-center gap-1 hover:text-ink ${right ? "flex-row-reverse" : ""} ${sorted ? "text-ink" : ""}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span aria-hidden className="w-2 text-[9px]">{sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : ""}</span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-rule transition-colors duration-100 hover:bg-paper-2">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`px-2 py-3 ${cell.column.columnDef.meta?.align === "right" ? "figures text-right" : ""}`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
