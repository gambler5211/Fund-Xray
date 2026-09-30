import Link from "next/link";
import { KiteCard } from "@/components/KiteCard";
import { RotationCard } from "@/components/RotationCard";
import { Notice } from "@/components/Notice";
import { EmptyState, Kicker } from "@/components/Section";
import { KITE_NOTICES, kiteStatus } from "@/lib/kite";
import { currentUser } from "@/lib/supabase/server";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ kite?: string }> }) {
  const { kite: code } = await searchParams;
  const user = await currentUser();
  const status = user ? await kiteStatus(user.id) : { state: "never" as const };
  const notice = code ? (KITE_NOTICES[code] ?? KITE_NOTICES.error) : null;

  const headline =
    status.state === "connected"
      ? "Zerodha is connected; your first scan builds from here"
      : status.state === "expired"
        ? "Your Zerodha connection ended at 6 AM"
        : "Your first scan appears here once Kite is connected";

  return (
    <div className="flex flex-col">
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <section className="flex flex-col gap-4 border-b border-ink py-7 md:py-8">
        <Kicker>Your alignment</Kicker>
        <h1 className="max-w-[22ch] text-[30px] font-medium leading-[1.1] tracking-[-0.015em] md:text-[50px]">{headline}</h1>
        <p className="max-w-[62ch] text-body leading-relaxed text-ink-2 md:text-lead">
          Fund X-Ray reads your holdings from Zerodha, maps each stock to its sector, and tells you how much of your
          money sits in sectors that are gaining or losing strength against the market.
        </p>
      </section>

      <div className="pt-7">
        <KiteCard status={status} />
      </div>

      <div className="grid gap-6 py-7 md:grid-cols-2 md:gap-10">
        {user ? (
          <RotationCard userId={user.id} />
        ) : (
          <EmptyState title="Rotation" body="Sector strength against your benchmark in four quadrants, with your money placed on it." />
        )}
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
