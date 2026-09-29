/** Only allow redirects back into this site, e.g. "/settings", never "//evil.com" or "https://…". */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
