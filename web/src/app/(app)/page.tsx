import Link from "next/link";
import { EmptyState, Kicker } from "@/components/Section";

export default function TodayPage() {
  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-4 border-b border-ink py-7 md:py-8">
        <Kicker>Your alignment</Kicker>
        <h1 className="max-w-[22ch] text-[30px] font-medium leading-[1.1] tracking-[-0.015em] md:text-[50px]">
          Your first scan appears here once Kite is connected
        </h1>
        <p className="max-w-[62ch] text-body leading-relaxed text-ink-2 md:text-lead">
          Fund X-Ray reads your holdings from Zerodha, maps each stock to its sector, and tells you how much of your
          money sits in sectors that are gaining or losing strength against the market.
        </p>
      </section>

      <div className="grid gap-6 py-7 md:grid-cols-3 md:gap-10">
        <EmptyState
          title="Connect Kite"
          body="You log in on Zerodha's own page; your password never touches this app. Holdings refresh each time you connect."
          action={
            <button
              type="button"
              disabled
              className="h-11 cursor-not-allowed bg-ink px-5 font-sans text-ui font-semibold text-paper opacity-60"
              title="Arrives on Day 4"
            >
              Connect Zerodha (Day 4)
            </button>
          }
        />
        <EmptyState
          title="Rotation"
          body="Sector strength against the Nifty 500 in four quadrants, with your money placed on it."
          action={
            <Link href="/rotation" className="font-sans text-ui">
              Arrives in week 2
            </Link>
          }
        />
        <EmptyState
          title="Health checks"
          body="Surveillance lists, red flags, promoter pledges and exit liquidity for whatever you hold."
          action={
            <Link href="/health" className="font-sans text-ui">
              Arrives in week 4
            </Link>
          }
        />
      </div>
    </div>
  );
}
