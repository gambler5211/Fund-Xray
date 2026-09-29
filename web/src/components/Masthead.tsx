import Link from "next/link";
import type { KiteStatus } from "@/lib/kite";
import { AccountMenu } from "./AccountMenu";
import { KitePill } from "./KitePill";
import { EditionDate } from "./EditionDate";
import { RefreshButton } from "./RefreshButton";
import { ThemeToggle } from "./ThemeToggle";
import { TopNav } from "./TopNav";

export function Masthead({ user, kite }: { user?: { name: string | null; email: string } | null; kite?: KiteStatus | null }) {
  return (
    <header className="pt-4 md:pt-7">
      {/* Date line */}
      <div className="flex items-center justify-between gap-4 pb-3 font-sans text-caption text-ink-3 md:text-[13px]">
        <EditionDate />
        <div className="flex items-center gap-3 md:gap-4">
          <KitePill status={kite ?? null} />
          <RefreshButton kiteConnected={kite?.state === "connected"} />
          <ThemeToggle />
          <AccountMenu name={user?.name} email={user?.email} />
        </div>
      </div>

      {/* Wordmark between a thick and a thin rule */}
      <div className="flex flex-col items-center gap-2.5 border-t-[3px] border-b border-ink py-3">
        <Link
          href="/"
          className="text-[32px] font-semibold leading-none tracking-[-0.02em] no-underline md:text-h1"
        >
          Fund X-Ray
        </Link>
        <TopNav />
      </div>
    </header>
  );
}
