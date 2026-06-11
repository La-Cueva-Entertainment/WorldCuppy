"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav({
  isAdmin,
}: {
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  const tabs = [
    { href: "/dashboard", label: "Standings", icon: "🏆" },
    { href: "/draft",     label: "Draft",     icon: "🎯" },
    { href: "/lineup",    label: "My Lineup", icon: "⚽" },
    { href: "/preview",   label: "Preview",   icon: "👀" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "⚙️" }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-zinc-200 bg-white md:hidden">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              active
                ? "text-emerald-600"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span className="leading-none">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
