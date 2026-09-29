import Link from "next/link";
import { GoogleButton } from "@/components/GoogleButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { safeNext } from "@/lib/safeNext";

export const metadata = { title: "Sign in · Fund X-Ray" };

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled. Try again when you're ready.",
  missing_code: "Google didn't send a sign-in code back. Try again.",
  exchange: "That sign-in link had expired. Try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; signed_out?: string; deleted?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const error = sp.error ? (ERRORS[sp.error] ?? ERRORS.exchange) : null;
  const notice = sp.deleted ? "Your account and all its data have been deleted." : sp.signed_out ? "You're signed out." : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col px-5 md:px-18">
      <div className="flex justify-end pt-4 md:pt-7">
        <ThemeToggle />
      </div>

      <main className="fade-in flex flex-1 items-center justify-center py-12">
        <div className="flex w-full max-w-[400px] flex-col items-center gap-6 text-center">
          <div className="flex w-full flex-col items-center gap-3 border-t-[3px] border-b border-ink py-4">
            <h1 className="text-[40px] font-semibold leading-none tracking-[-0.02em] md:text-h1">Fund X-Ray</h1>
          </div>
          <p className="text-lead leading-snug text-ink-2">
            A weekly X-ray of where your money sits, and which sectors it is leaving.
          </p>

          {notice ? (
            <p role="status" className="w-full border-y border-rule py-2 font-sans text-ui text-ink-2">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="w-full border-y border-loss py-2 font-sans text-ui text-loss">
              {error}
            </p>
          ) : null}

          <GoogleButton full next={next} />

          <p className="font-sans text-caption leading-relaxed text-ink-3">
            Invite only during the private beta. Data and analytics only, not investment advice.{" "}
            <Link href="/welcome">What is this?</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
