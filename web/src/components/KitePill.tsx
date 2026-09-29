"use client";

import { useEffect, useState } from "react";
import { istTime } from "@/lib/format";
import type { KiteStatus } from "@/lib/kite";

const SOON_MS = 60 * 60 * 1000; // amber for the last hour

/**
 * Kite status in the date line:
 *   green "Connected 9:12 AM" · amber "Expires in 40 min" · grey "Reconnect" / "Connect Kite".
 * Times are worked out in the browser (and every minute) so they never show a stale value.
 */
export function KitePill({ status }: { status: KiteStatus | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!status) return null; // signed out (/ui page)

  const expires = status.expiresAt ? new Date(status.expiresAt).getTime() : 0;
  const state = status.state === "connected" && now !== null && expires <= now ? "expired" : status.state;

  if (state === "never") return <Pill dot="bg-ink-3" href="/kite/connect" label="Connect Kite" title="Connect your Zerodha account" />;
  if (state === "expired") return <Pill dot="bg-ink-3" href="/kite/connect" label="Reconnect" title="Your Zerodha connection expired at 6 AM" />;

  const left = now === null ? Infinity : expires - now;
  if (left <= SOON_MS) {
    const mins = Math.max(1, Math.round(left / 60000));
    return <Pill dot="bg-warn" tone="text-warn" label={`Expires in ${mins} min`} title="Zerodha connections end at 6 AM each day" />;
  }
  const at = status.connectedAt
    ? istTime(status.connectedAt)
    : "";
  return <Pill dot="bg-gain" label={`Connected ${at}`.trim()} short="Kite" title={`Zerodha connected${status.kiteUserId ? ` as ${status.kiteUserId}` : ""}, until 6 AM`} />;
}

function Pill({ dot, label, short, title, href, tone = "" }: { dot: string; label: string; short?: string; title: string; href?: string; tone?: string }) {
  const body = (
    <>
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className={`figures ${short ? "hidden md:inline" : ""} ${tone}`}>{label}</span>
      {short ? <span className={`md:hidden ${tone}`}>{short}</span> : null}
    </>
  );
  return href ? (
    <a href={href} title={title} className="flex items-center gap-2 text-ink no-underline hover:text-accent">
      {body}
    </a>
  ) : (
    <span title={title} className="flex items-center gap-2" role="status">
      {body}
    </span>
  );
}
