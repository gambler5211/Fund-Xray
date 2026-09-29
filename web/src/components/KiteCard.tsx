import { LinkButton } from "@/components/kit/Button";
import { Kicker } from "@/components/Section";
import { istTime } from "@/lib/format";
import type { KiteStatus } from "@/lib/kite";

const STEPS = [
  ["Log in on Zerodha's own page", "You type your Zerodha password and TOTP on kite.zerodha.com, never here."],
  ["Approve read access", "Fund X-Ray reads holdings and positions. It never places orders or moves money."],
  ["Come straight back", "Your holdings load in a few seconds. The connection lasts until 6 AM tomorrow."],
];

/**
 * The first-run card on Today: what connecting Zerodha means, three short steps, one button.
 * The same spot shows "Reconnect" once the daily connection has run out.
 */
export function KiteCard({ status }: { status: KiteStatus }) {
  if (status.state === "connected") {
    const until = status.expiresAt
      ? istTime(status.expiresAt, { weekday: "short", hour: "numeric", minute: "2-digit" })
      : "6 AM";
    return (
      <section className="flex flex-col gap-2 border-b border-rule py-6">
        <Kicker>Zerodha</Kicker>
        <p className="text-lead leading-snug">
          Connected{status.kiteUserId ? <> as <span className="figures">{status.kiteUserId}</span></> : null}, until {until}.
        </p>
        <p className="font-sans text-ui text-ink-3">Your holdings table and totals arrive with Day 5.</p>
      </section>
    );
  }

  const expired = status.state === "expired";
  return (
    <section className={`flex flex-col gap-5 border border-ink p-5 md:flex-row md:items-start md:gap-10 md:p-7 ${expired ? "md:max-w-[640px]" : ""}`}>
      <div className="flex max-w-[34ch] flex-col gap-3">
        <Kicker>{expired ? "Connection ended" : "First step"}</Kicker>
        <h2 className="text-[26px] font-medium leading-tight md:text-h3">
          {expired ? "Reconnect your Zerodha account" : "Connect your Zerodha account"}
        </h2>
        <p className="text-body leading-relaxed text-ink-2">
          {expired
            ? "Zerodha ends every connection at 6 AM. Log in again to refresh your numbers; everything you saved is still here."
            : "Fund X-Ray needs to read your holdings once to build your first X-ray. You log in on Zerodha's own page; your password never touches this app."}
        </p>
        <div className="pt-1">
          <LinkButton href="/kite/connect" native>{expired ? "Reconnect Zerodha" : "Connect Zerodha"}</LinkButton>
        </div>
      </div>
      {!expired ? (
        <ol className="flex flex-1 flex-col md:border-l md:border-rule md:pl-10">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4 border-b border-rule py-3.5 first:pt-0 last:border-0">
              <span className="w-5 shrink-0 text-[24px] leading-none font-medium text-accent">{i + 1}</span>
              <div className="flex flex-col gap-1">
                <span className="font-sans text-ui font-semibold text-ink">{title}</span>
                <span className="text-[15px] leading-relaxed text-ink-2">{body}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
