import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let userId: string | undefined = session.user.id;
  if (!userId) {
    const email = session.user.email?.toLowerCase().trim();
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      userId = user?.id;
    }
  }
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    tournamentId?: string;
    teamName?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updates: Promise<unknown>[] = [];

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 64);
    if (name.length > 0) {
      updates.push(prisma.user.update({ where: { id: userId }, data: { name } }));
    }
  }

  if (typeof body.tournamentId === "string" && typeof body.teamName === "string") {
    const teamName = body.teamName.trim().slice(0, 64) || null;
    updates.push(
      prisma.tournamentParticipant.updateMany({
        where: { userId, tournamentId: body.tournamentId },
        data: { teamName },
      })
    );
  }

  await Promise.all(updates);
  return NextResponse.json({ ok: true });
}
