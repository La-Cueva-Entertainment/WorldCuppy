"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BanterNavBtn() {
  const pathname = usePathname();
  const active = pathname === "/banter" || pathname.startsWith("/banter/");

  return (
    <Link
      href="/banter"
      aria-label="Banter"
      title="Banter"
      className={`nav-banter-btn${active ? " active" : ""}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </Link>
  );
}
