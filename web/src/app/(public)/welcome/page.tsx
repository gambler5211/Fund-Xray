import Link from "next/link";
import { GoogleButton } from "@/components/GoogleButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Kicker } from "@/components/Section";

export const metadata = {
  title: "Fund X-Ray: see where your money really sits",
  description:
    "Connect Zerodha once. Get a plain-English X-ray of your portfolio: sector strength, hidden concentration, red flags and the news that touches what you own.",
};

const STEPS = [
  {
    n: "1",
    title: "Sign in with Google",
    body: "No new password to remember. Your account holds only your settings and your holdings snapshot.",
  },
  {
    n: "2",
    title: "Connect your Zerodha account",
    body: "You log in on Zerodha's own page; your password never reaches Fund X-Ray. The app reads holdings and never places orders.",
  },
  {
    n: "3",
    title: "Read your edition",
    body: "A fresh front page whenever you open it, and a short Saturday digest on Telegram if you want one.",
  },
];

const CHECKS = [
  ["Sector rotation", "Which sectors are gaining or losing strength against the market, week by week."],
  ["Your alignment", "How much of your money sits in the strong sectors, and how much in the fading ones."],
  ["Hidden concentration", "Stocks that rise and fall together, so twenty names can behave like four."],
  ["Health checks", "NSE surveillance lists, promoter pledges, insider trades and red-flag rules."],
  ["News and filings", "Headlines and exchange filings scored against what you hold, with the quoted source."],
  ["Tax and exit liquidity", "Gains used this year, loss-harvest reminders, and how long each position takes to sell."],
];

const NEVER = [
  "Tell you to buy or sell a stock, give price targets, or run model portfolios.",
  "Place orders or move money in your Zerodha account.",
  "Show your holdings to anyone else, or sell your data.",
];

const DATA = [
  "Stored in India, in an encrypted database you alone can read.",
  "Your Zerodha connection expires every morning; reconnect when you want fresh numbers.",
  "One button in Settings deletes everything, for good.",
];

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ signed_out?: string; deleted?: string }>;
}) {
  const sp = await searchParams;
  const notice = sp.deleted ? "Your account and all its data have been deleted." : sp.signed_out ? "You're signed out." : null;
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col px-5 pb-6 md:px-18">
      {/* Date line */}
      <div className="flex items-center justify-between gap-4 pt-4 pb-3 font-sans text-caption text-ink-3 md:pt-7 md:text-[13px]">
        <span>
          <span className="hidden md:inline">A private edition for you and a few friends · Est. 2026</span>
          <span className="md:hidden">Private beta · Est. 2026</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline">Free during the private beta</span>
          <ThemeToggle />
        </div>
      </div>

      {notice ? (
        <p role="status" className="mb-3 border-y border-rule py-2 text-center font-sans text-ui text-ink-2">
          {notice}
        </p>
      ) : null}

      {/* Masthead */}
      <header className="flex flex-col items-center gap-3 border-t-[3px] border-b border-ink py-3">
        <div className="text-[32px] font-semibold leading-none tracking-[-0.02em] md:text-h1">Fund X-Ray</div>
        <nav aria-label="Sections" className="hidden items-center gap-7 font-sans text-ui font-medium md:flex">
          <a href="#how" className="no-underline">How it works</a>
          <a href="#checks" className="no-underline">What it checks</a>
          <a href="#privacy" className="no-underline">Privacy</a>
          <Link href="/login" className="border-b-2 border-accent pb-0.5 no-underline">Sign in</Link>
        </nav>
      </header>

      <main className="fade-in flex-1">
        {/* Lead story + sample edition */}
        <section className="flex flex-col gap-10 border-b border-ink py-8 md:flex-row md:items-center md:gap-14 md:py-11">
          <div className="flex max-w-[700px] flex-1 flex-col gap-5 md:gap-6">
            <Kicker>Your portfolio, seen through</Kicker>
            <h1 className="text-[36px] font-medium leading-[1.06] tracking-[-0.02em] md:text-[64px] md:leading-[1.04]">
              See where your money really sits, and which sectors it is leaving
            </h1>
            <p className="text-[18px] leading-relaxed text-ink-2 md:text-[21px]">
              Connect Zerodha once. Every Saturday you get a plain-English X-ray of your portfolio: sector strength,
              hidden concentration, red flags and the news that touches what you own.
            </p>
            <div className="flex flex-col gap-3 pt-1 md:flex-row md:items-center md:gap-5">
              <GoogleButton />
              <span className="text-center font-sans text-ui text-ink-3 md:text-left">
                Invite only for now. Takes two minutes.
              </span>
            </div>
          </div>
          <SampleEdition />
        </section>

        {/* How it works */}
        <section id="how" className="flex scroll-mt-6 flex-col gap-5 border-b border-ink py-8">
          <h2 className="border-b-2 border-ink pb-1.5 text-[26px] font-semibold md:border-0 md:pb-0 md:text-[30px]">
            How it works
          </h2>
          <ol className="grid gap-5 md:grid-cols-3 md:gap-10">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="flex gap-4 border-b border-rule pb-4 last:border-0 md:flex-col md:gap-2 md:border-t-2 md:border-b-0 md:border-ink md:pt-3 md:pb-0"
              >
                <span className="w-6 shrink-0 text-[30px] leading-none font-medium text-accent md:text-h2">{s.n}</span>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[19px] font-semibold md:text-[21px]">{s.title}</span>
                  <span className="text-body leading-relaxed text-ink-2">{s.body}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* What it checks */}
        <section id="checks" className="flex scroll-mt-6 flex-col gap-5 border-b border-ink py-8">
          <div className="flex items-baseline justify-between border-b-2 border-ink pb-1.5 md:border-0 md:pb-0">
            <h2 className="text-[26px] font-semibold md:text-[30px]">What it checks</h2>
            <span className="hidden font-sans text-[13px] text-ink-3 md:inline">Every figure links to its source</span>
          </div>
          <div className="grid md:grid-cols-3 md:gap-x-10">
            {CHECKS.map(([title, body], i) => (
              <div
                key={title}
                className={`flex flex-col gap-1.5 py-3 ${i < CHECKS.length - 1 ? "border-b border-rule" : ""} ${
                  i >= 3 ? "md:border-b-0" : ""
                }`}
              >
                <span className="text-[18px] font-semibold md:text-[19px]">{title}</span>
                <span className="text-[15px] leading-relaxed text-ink-2 md:text-body">{body}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Promises */}
        <section id="privacy" className="grid scroll-mt-6 gap-5 py-8 md:grid-cols-2 md:gap-10">
          <PromiseBox title="What it will never do" items={NEVER} />
          <PromiseBox title="Your data" items={DATA} />
        </section>

        <div className="pb-6 md:hidden">
          <GoogleButton full />
        </div>
      </main>

      <footer className="flex flex-col gap-2 border-t border-ink pt-3 font-sans text-caption text-ink-3 md:flex-row md:justify-between">
        <span>Data and analytics only. Not investment advice. Not affiliated with Zerodha or NSE.</span>
        <span>
          <a href="#privacy">Privacy</a> · <a href="#">Terms</a> · <a href="#">Contact</a>
        </span>
      </footer>
    </div>
  );
}

function PromiseBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-3 border border-ink p-4 md:px-6 md:py-5">
      <h2 className="text-[21px] font-semibold md:text-[24px]">{title}</h2>
      {items.map((t, i) => (
        <p key={t} className={`text-body leading-relaxed md:text-[17px] ${i < items.length - 1 ? "border-b border-rule pb-2" : ""}`}>
          {t}
        </p>
      ))}
    </div>
  );
}

/** A framed "front page" showing what an edition looks like. Sample data, clearly labelled. */
function SampleEdition() {
  return (
    <figure className="flex w-full shrink-0 flex-col gap-3 md:w-[520px]">
      <div className="flex flex-col gap-3 border border-ink bg-paper p-4 shadow-[6px_6px_0_var(--rule)] md:px-6 md:py-5 md:shadow-[8px_8px_0_var(--rule)]">
        <div className="flex justify-between border-b-2 border-ink pb-2 font-sans text-[11px] text-ink-3">
          <span className="font-semibold tracking-[0.12em]">SAMPLE EDITION</span>
          <span>Saturday</span>
        </div>
        <div className="font-sans text-[11px] font-semibold tracking-[0.14em] text-accent">YOUR ALIGNMENT</div>
        <div className="text-[22px] leading-[1.15] font-medium md:text-h3 md:leading-[1.12]">
          Nearly two-fifths of your money sits in sectors losing strength
        </div>
        <div className="flex flex-col gap-1.5" aria-label="You: 43.6% leading, 17.4% improving, 38.9% weakening. Nifty 500 shown for comparison.">
          <Bar label="You" parts={[[43.6, "bg-q-leading"], [17.5, "bg-q-improving"], [38.9, "bg-q-weakening"]]} />
          <Bar label="Nifty 500" muted parts={[[41, "bg-q-leading"], [35, "bg-q-improving"], [15, "bg-q-weakening"], [9, "bg-q-lagging"]]} />
        </div>
        <div className="flex flex-col gap-2 border-t border-rule pt-3 text-body">
          <div className="flex gap-3">
            <span className="w-24 shrink-0 pt-[3px] font-sans text-[11px] font-semibold tracking-[0.1em] text-q-lagging">SURVEILLANCE</span>
            <span>One holding entered NSE&apos;s ASM list</span>
          </div>
          <div className="flex gap-3">
            <span className="w-24 shrink-0 pt-[3px] font-sans text-[11px] font-semibold tracking-[0.1em] text-q-improving">CONCENTRATION</span>
            <span>Ten stocks, about three bets</span>
          </div>
        </div>
      </div>
      <figcaption className="font-sans text-caption text-ink-3">
        Illustration with sample data. Your edition is built from your own holdings.
      </figcaption>
    </figure>
  );
}

function Bar({ label, parts, muted = false }: { label: string; parts: [number, string][]; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-[62px] shrink-0 font-sans text-caption ${muted ? "text-ink-3" : "font-semibold"}`}>{label}</span>
      <div className={`flex h-[18px] flex-1 gap-0.5 ${muted ? "opacity-55" : ""}`} aria-hidden>
        {parts.map(([w, cls], i) => (
          <div key={i} className={cls} style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}
