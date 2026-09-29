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

/** Drops trailing zeros: "12.00" -> "12", "18.60" -> "18.6", "100" stays "100". */
function trimZeros(s: string) {
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** ₹1.24 Cr, ₹18.6 L, ₹42,500. Indian units for headlines and tight spaces. */
export function rupeesShort(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e7) return `${sign}₹${trimZeros((a / 1e7).toFixed(2))} Cr`;
  if (a >= 1e5) return `${sign}₹${trimZeros((a / 1e5).toFixed(2))} L`;
  return `${sign}${rupees(a)}`;
}

/** +₹1,240 / −₹860 with a real minus sign. */
export function signedRupees(n: number) {
  const s = rupees(Math.abs(n));
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

/** 38.9% (no sign). Use signedPct for changes. */
export function pct(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`;
}
