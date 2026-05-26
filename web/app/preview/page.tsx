import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import TournamentView from "@/components/TournamentView";
import { authOptions } from "@/lib/auth";
import { isSiteOwner } from "@/lib/siteOwner";
import { prisma } from "@/lib/prisma";
import { MOCK_PLAYERS, MOCK_TODAY_MATCHES, MOCK_MATCHES_BY_STAGE } from "@/lib/mock-data";

export default async function PreviewPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let isAdmin = isSiteOwner(session);
  if (!isAdmin) {
    let userId: string | undefined = session.user.id;
    if (!userId) {
      const email = session.user.email?.toLowerCase().trim();
      if (email) {
        const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isAdmin: true } });
        userId = user?.id;
        isAdmin = user?.isAdmin ?? false;
      }
    } else {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
      isAdmin = user?.isAdmin ?? false;
    }
  }

  if (!isAdmin) redirect("/");

  return (
    <TournamentView
      name="FIFA World Cup"
      year={2026}
      isDemo={true}
      players={MOCK_PLAYERS}
      todayMatches={MOCK_TODAY_MATCHES}
      matchesByStage={MOCK_MATCHES_BY_STAGE}
    />
  );
}
