"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive } from "@/lib/nav";

const ICONS: Record<string, React.ReactNode> = {
  "/": <path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5" />,
  "/portfolio": (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  "/rotation": <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />,
  "/health": <path d="M3 12h4l2-5 4 10 2-5h6" />,
  "/settings": (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
};

/** Phone-only tab bar; the masthead nav takes over from 768 px up. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 grid h-[72px] grid-cols-5 items-center border-t border-ink bg-paper font-sans md:hidden"
    >
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-full flex-col items-center justify-center gap-1 text-caption no-underline ${
              active ? "font-semibold text-accent" : "text-ink-3"
            }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {ICONS[item.href]}
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
