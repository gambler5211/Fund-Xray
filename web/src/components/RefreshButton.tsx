/**
 * Refresh in the date line. Pulls fresh holdings and prices from Kite; that pull arrives on Day 5.
 * Until then it is shown disabled, with the reason as its tooltip.
 */
export function RefreshButton({ kiteConnected = false }: { kiteConnected?: boolean }) {
  return (
    <button
      type="button"
      disabled
      title={kiteConnected ? "Holdings refresh arrives on Day 5" : "Connect Kite first"}
      className="hidden items-center gap-1 font-sans text-caption text-ink-3 enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex md:text-[13px]"
    >
      <span aria-hidden>↻</span> Refresh
    </button>
  );
}
