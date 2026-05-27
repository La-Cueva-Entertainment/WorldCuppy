"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { InstallButton } from "@/components/InstallButton";

export function MobileNav({
  isAdmin,
  picksCount,
}: {
  isAdmin?: boolean;
  picksCount?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  const close = () => setOpen(false);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        {open ? <XIcon /> : <HamburgerIcon />}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={close} />

          {/* Dropdown panel */}
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-white/10 bg-zinc-900 p-2 shadow-2xl">
            {typeof picksCount === "number" && (
              <div className="mb-1 px-3 py-2 text-xs font-semibold text-emerald-400">
                {picksCount} picks
              </div>
            )}

            <NavItem href="/" exact onClick={close}>Home</NavItem>
            <NavItem href="/standings" onClick={close}>Standings</NavItem>
            <NavItem href="/draft" onClick={close}>Draft</NavItem>
            <NavItem href="/profile" onClick={close}>My Profile</NavItem>

            {isAdmin && (
              <>
                <div className="my-1 border-t border-white/10" />
                <NavItem href="/preview" onClick={close}>Preview</NavItem>
                <NavItem href="/admin" onClick={close}>Admin</NavItem>
              </>
            )}

            <div className="my-1 border-t border-white/10" />
            <InstallButton variant="menu" />
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function NavItem({
  href,
  exact = false,
  onClick,
  children,
}: {
  href: string;
  exact?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-white/15 text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="2" y1="4.5" x2="16" y2="4.5" />
      <line x1="2" y1="9" x2="16" y2="9" />
      <line x1="2" y1="13.5" x2="16" y2="13.5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="3" x2="15" y2="15" />
      <line x1="15" y1="3" x2="3" y2="15" />
    </svg>
  );
}
