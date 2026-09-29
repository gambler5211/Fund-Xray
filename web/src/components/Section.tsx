/** Small caps oxblood label above a lead, e.g. "YOUR ALIGNMENT". */
export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-sans text-caption font-semibold uppercase tracking-[0.14em] text-accent">
      {children}
    </div>
  );
}

/** Empty state: what goes here, and the one thing to do next. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 border border-ink p-5 md:p-6">
      <h2 className="text-lead font-semibold">{title}</h2>
      <p className="max-w-[60ch] text-body leading-relaxed text-ink-2">{body}</p>
      {action}
    </div>
  );
}

/** A page that isn't built yet: tells you which week it arrives. */
export function ComingSoon({ kicker, title, week, body }: { kicker: string; title: string; week: number; body: string }) {
  return (
    <section className="flex flex-col gap-4 py-7">
      <Kicker>{kicker}</Kicker>
      <h1 className="max-w-[20ch] text-[30px] font-medium leading-[1.12] tracking-[-0.015em] md:text-h2">{title}</h1>
      <p className="max-w-[60ch] text-body leading-relaxed text-ink-2 md:text-lead">{body}</p>
      <p className="font-sans text-caption text-ink-3">Arrives in week {week} of the build plan.</p>
    </section>
  );
}
