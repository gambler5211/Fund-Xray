/**
 * Refresh in the date line. Pulls fresh holdings and prices once Kite is connected (Day 4–5).
 * Until then it is shown disabled, with the reason as its tooltip.
 */
export function RefreshButton({ disabled = true }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? "Connect Kite first" : "Fetch fresh holdings and prices"}
      className="hidden items-center gap-1 font-sans text-caption text-ink-3 enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex md:text-[13px]"
    >
      <span aria-hidden>↻</span> Refresh
    </button>
  );
}
