/**
 * A boxed panel. Per the design rules, boxes are for asides (a note, a promise, a tip), not for
 * every block of content; main content sits between rules instead.
 */
export function Card({
  title,
  actions,
  footer,
  children,
}: {
  title?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col border border-ink">
      {title || actions ? (
        <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 md:px-5">
          {title ? <h3 className="text-[18px] font-semibold md:text-[20px]">{title}</h3> : <span />}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="px-4 py-4 text-body leading-relaxed text-ink-2 md:px-5">{children}</div>
      {footer ? (
        <footer className="border-t border-rule px-4 py-3 font-sans text-caption text-ink-3 md:px-5">{footer}</footer>
      ) : null}
    </section>
  );
}
