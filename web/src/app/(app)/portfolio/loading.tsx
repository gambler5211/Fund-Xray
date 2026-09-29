import { HoldingsSkeleton, Skeleton } from "@/components/kit/States";

/** Portfolio while it loads: headline and stat tiles, then the sector bars and rows. */
export default function PortfolioLoading() {
  return (
    <div role="status" aria-label="Loading your portfolio" className="flex flex-col">
      <section className="grid gap-7 border-b border-ink py-7 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-12 md:py-8">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-full max-w-[520px] md:h-12" />
          <Skeleton className="h-4 w-full max-w-[520px]" />
        </div>
        <div className="grid grid-cols-2 content-start gap-x-6 gap-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-4 border-b border-ink py-7">
        <Skeleton className="h-6 w-56" />
        {[88, 70, 55, 36].map((w) => (
          <div key={w} className="grid grid-cols-[140px_1fr] gap-4 md:grid-cols-[240px_1fr]">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-2.5" />
          </div>
        ))}
      </section>
      <section className="py-7">
        <HoldingsSkeleton rows={6} />
      </section>
    </div>
  );
}
