export type NavItem = { href: string; label: string; week?: number };

export const NAV: NavItem[] = [
  { href: "/", label: "Today" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/rotation", label: "Rotation", week: 2 },
  { href: "/health", label: "Health", week: 4 },
  { href: "/settings", label: "Settings" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
