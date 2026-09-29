const IST = "Asia/Kolkata";

/** "Tuesday, 29 September 2026" in Indian time. */
export function editionDate(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** "Tue 29 Sep" for small screens. */
export function shortDate(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

/** ₹2,89,167 — Indian digit grouping, no decimals. */
export function rupees(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** +2.29% / −0.71% with a real minus sign. */
export function signedPct(n: number, digits = 2) {
  const s = Math.abs(n).toFixed(digits);
  return n > 0 ? `+${s}%` : n < 0 ? `−${s}%` : `${s}%`;
}
