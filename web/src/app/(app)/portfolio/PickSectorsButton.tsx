"use client";

/** Jumps to the holdings table filtered to the stocks that still need a sector. */
export function PickSectorsButton({ count }: { count: number }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("fx:holdings-search", { detail: "unmapped" }));
        document.getElementById("holdings")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className="h-9 border border-ink px-3 font-sans text-ui font-semibold text-ink hover:bg-paper-2"
    >
      Pick sectors for {count} {count === 1 ? "stock" : "stocks"}
    </button>
  );
}
