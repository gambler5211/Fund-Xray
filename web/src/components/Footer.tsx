import { ApiStatus } from "./ApiStatus";

export function Footer() {
  return (
    <footer className="mt-10 flex flex-col gap-2 border-t border-ink pt-2.5 font-sans text-caption text-ink-3 md:flex-row md:justify-between">
      <span>Data and analytics only. Not investment advice.</span>
      <ApiStatus />
    </footer>
  );
}
