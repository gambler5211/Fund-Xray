import { Skeleton } from "@/components/kit/States";

/** Shown while a signed-in page loads its data: the shape of a page lead. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-4 border-b border-ink py-7 md:py-8">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-9 w-full max-w-[520px] md:h-12" />
      <Skeleton className="h-9 w-3/4 max-w-[380px] md:h-12" />
      <Skeleton className="mt-2 h-4 w-full max-w-[560px]" />
      <Skeleton className="h-4 w-2/3 max-w-[420px]" />
    </div>
  );
}
