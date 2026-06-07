"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm nav-signout"
      onClick={async () => {
        await signOut({ redirect: false });
        window.location.href = "/";
      }}
    >
      Sign out
    </button>
  );
}
