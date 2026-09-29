/** One line of news at the top of a page: an error in brick, anything else in ink. */
export function Notice({ tone, children }: { tone: "error" | "neutral"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mt-5 border-y py-3 font-sans text-ui ${tone === "error" ? "border-loss text-loss" : "border-rule text-ink-2"}`}
    >
      {children}
    </p>
  );
}
