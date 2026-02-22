import type { Session } from "next-auth";

function parseEmailAllowList(raw: string | undefined) {
  return (raw ?? "")
    .split(/[\s,;]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isSiteOwner(session: Session | null) {
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email) return false;

  const allowList = parseEmailAllowList(process.env.SITE_OWNER_EMAILS);
  return allowList.includes(email);
}
