import Link from "next/link";

type Variant = "primary" | "secondary";

const BASE =
  "inline-flex h-11 items-center justify-center gap-2 px-5 font-sans text-ui font-semibold no-underline transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:text-paper hover:opacity-90",
  secondary: "border border-ink bg-transparent text-ink hover:bg-paper-2",
};
const DISABLED = "cursor-not-allowed opacity-50 hover:opacity-50";

/** A button that does something on this page. */
export function Button({
  variant = "primary",
  disabled = false,
  className = "",
  ...rest
}: { variant?: Variant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button disabled={disabled} className={`${BASE} ${VARIANT[variant]} ${disabled ? DISABLED : ""} ${className}`} {...rest} />;
}

/** A link that looks like a button, for moving to another page. */
export function LinkButton({
  variant = "primary",
  href,
  className = "",
  children,
}: {
  variant?: Variant;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT[variant]} ${className}`}>
      {children}
    </Link>
  );
}
