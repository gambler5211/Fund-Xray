import { ApiStatus } from "./ApiStatus";
import { Freshness } from "./Freshness";

export function Footer({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <footer className="mt-10 flex flex-col gap-2 border-t border-ink pt-3 font-sans text-caption text-ink-3 md:flex-row md:justify-between md:gap-6">
      <span className="flex flex-col gap-1">
        <span>Data and analytics only. Not investment advice.</span>
        {signedIn ? <Freshness /> : null}
      </span>
      <ApiStatus />
    </footer>
  );
}
