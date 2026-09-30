import { Skeleton } from "@/components/kit/States";

/** Rotation while it loads: the headline, then a square shaped like the quadrant chart. */
export default function RotationLoading() {
  return (
    <div role="status" aria-label="Loading sector rotation" className="flex flex-col">
      <section className="flex flex-col gap-4 border-b border-ink py-7 md:py-8">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-10 w-full max-w-[640px] md:h-12" />
        <Skeleton className="h-4 w-full max-w-[560px]" />
      </section>
      <section className="flex flex-col gap-4 py-7">
        <Skeleton className="h-6 w-64" />
        <div className="flex gap-1">
          {["w-18", "w-20", "w-22", "w-24"].map((w) => (
            <Skeleton key={w} className={`h-9 ${w}`} />
          ))}
        </div>
        <div className="relative aspect-square max-h-[640px] w-full border border-rule md:aspect-[4/3]">
          <div className="absolute inset-y-0 left-1/2 border-l border-rule" />
          <div className="absolute inset-x-0 top-1/2 border-t border-rule" />
          {[
            [62, 30], [70, 42], [55, 22], [35, 60], [40, 72], [28, 38], [66, 64], [48, 55],
          ].map(([x, y]) => (
            <div key={`${x}-${y}`} className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
