"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

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
    <>
      {/* Burger button — only visible on mobile (CSS hides nav-links at ≤860px) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        className="icon-btn nav-burger"
      >
        {open ? <XIcon /> : <HamburgerIcon />}
      </button>

      {/* Scrim */}
      <div className={`drawer-back${open ? " open" : ""}`} onClick={close} />

      {/* Slide-in drawer */}
      <div className={`drawer${open ? " open" : ""}`}>
        {/* Drawer header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <span style={{ fontFamily: "var(--font-archivo), Archivo, sans-serif", fontWeight: 900, fontSize: "17px", color: "var(--ink)" }}>
            World<b style={{ color: "var(--gold)" }}>Cuppy</b>
          </span>
          <button type="button" onClick={close} className="icon-btn" aria-label="Close menu">
            <XIcon />
          </button>
        </div>

        {typeof picksCount === "number" && (
          <div className="badge grass" style={{ marginBottom: "8px", alignSelf: "flex-start" }}>
            {picksCount} picks
          </div>
        )}

        <DrawerLink href="/" exact onClick={close}>Home</DrawerLink>
        <DrawerLink href="/standings" onClick={close}>Standings</DrawerLink>
        <DrawerLink href="/draft" onClick={close}>Draft</DrawerLink>
        <DrawerLink href="/lineup" onClick={close}>My Teams</DrawerLink>
        <DrawerLink href="/news" onClick={close}>News</DrawerLink>
        <DrawerLink href="/profile" onClick={close}>Profile</DrawerLink>

        {isAdmin && (
          <>
            <hr className="divider" style={{ margin: "8px 0" }} />
            <DrawerLink href="/admin" onClick={close}>Admin</DrawerLink>
          </>
        )}

        <hr className="divider" style={{ margin: "8px 0" }} />
        <button
          type="button"
          onClick={async () => { await signOut({ redirect: false }); window.location.href = "/"; }}
          style={{
            fontFamily: "var(--font-archivo), Archivo, sans-serif", fontWeight: 700,
            fontSize: "17px", padding: "12px 10px", borderRadius: "10px",
            color: "var(--ink-soft)", background: "none", border: "none",
            cursor: "pointer", textAlign: "left", width: "100%",
          }}
        >
          Sign out
        </button>
      </div>
    </>
  );
}

function DrawerLink({
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
    <Link href={href} onClick={onClick} className={isActive ? "active" : ""}>
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
