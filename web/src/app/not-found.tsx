import { LinkButton } from "@/components/kit/Button";
import { Kicker } from "@/components/Section";

export const metadata = { title: "Not found · Fund X-Ray" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col justify-center gap-4 px-5 py-16">
      <Kicker>Page not found</Kicker>
      <h1 className="text-[30px] font-medium leading-[1.12] tracking-[-0.015em] md:text-h2">There&apos;s nothing at this address</h1>
      <p className="max-w-[60ch] text-body leading-relaxed text-ink-2">The link may be old, or the page may have moved.</p>
      <div>
        <LinkButton href="/">Go to Today</LinkButton>
      </div>
    </main>
  );
}
