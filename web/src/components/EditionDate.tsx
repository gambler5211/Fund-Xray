"use client";

import { useEffect, useState } from "react";
import { editionDate, shortDate } from "@/lib/format";

/** Today's date in IST, computed in the browser so statically built pages never show a stale date. */
export function EditionDate() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  if (!now) return <span className="inline-block h-3 w-40 bg-paper-2" aria-hidden />;
  return (
    <span className="figures">
      <span className="hidden md:inline">{editionDate(now)} · Your portfolio edition</span>
      <span className="md:hidden">{shortDate(now)}</span>
    </span>
  );
}
