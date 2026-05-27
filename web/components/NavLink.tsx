"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
        isActive
          ? "bg-white/15 font-semibold text-white ring-1 ring-white/20"
          : "font-medium text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
