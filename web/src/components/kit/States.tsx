/** A grey bar that stands in for text while data loads. Size it with a width and height class. */
export function Skeleton({ className = "h-4 w-40" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse bg-rule ${className}`} />;
}

/** Loading placeholder shaped like a few holdings rows. */
export function HoldingsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading your holdings" className="flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between border-b border-rule py-3.5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Something went wrong: say what, say what it means for their money, offer one action. */
export function ErrorState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 border border-loss p-5 md:p-6">
      <h2 className="text-lead font-semibold text-loss">{title}</h2>
      <p className="max-w-[60ch] text-body leading-relaxed text-ink-2">{body}</p>
      {action}
    </div>
  );
}

/** Marks numbers that are illustrations, never the user's own. */
export function SampleLabel({ children = "Sample data" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-block border border-ink-3 px-1.5 py-px font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
      {children}
    </span>
  );
}
