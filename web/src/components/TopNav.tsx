"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive } from "@/lib/nav";

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden gap-7 font-sans text-ui font-medium md:flex">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 pb-0.5 no-underline transition-colors duration-150 ${
              active ? "border-accent" : "border-transparent hover:border-rule"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
