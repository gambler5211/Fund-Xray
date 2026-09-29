"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Kicker } from "@/components/Section";
import { HoldingsSkeleton } from "@/components/kit/States";
import { refreshHoldings } from "@/lib/refresh";

/**
 * Shown after Zerodha sends you back: a check mark and the holdings skeleton while the first pull
 * runs, then straight on to Portfolio (with a note if the pull failed; the connection still stands).
 */
export function ReturnScreen({ kiteUserId }: { kiteUserId: string | null }) {
  const router = useRouter();
  useEffect(() => {
    let gone = false;
    refreshHoldings().then((r) => {
      if (!gone) router.replace(r.ok ? "/portfolio" : `/portfolio?pull=${r.code}`);
    });
    return () => {
      gone = true;
    };
  }, [router]);

  return (
    <section className="mx-auto flex w-full max-w-[640px] flex-col gap-5 py-10">
      <div className="flex items-center gap-4">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-gain text-[26px] leading-none text-gain">
          ✓
        </span>
        <div className="flex flex-col gap-1">
          <Kicker>Zerodha connected</Kicker>
          <h1 className="text-[28px] font-medium leading-tight md:text-h3">
            {kiteUserId ? `Connected as ${kiteUserId}` : "You're connected"}
          </h1>
        </div>
      </div>
      <p className="font-sans text-ui text-ink-3" role="status">
        Pulling your holdings…
      </p>
      <HoldingsSkeleton rows={4} />
    </section>
  );
}
