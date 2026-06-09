import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDraftAnalysis, getDraftAnalysis } from "@/lib/draftAnalysis";
import { isSiteOwner } from "@/lib/siteOwner";

// GET — fetch cached analysis
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const analysis = await getDraftAnalysis(tournamentId);
  if (!analysis) return NextResponse.json({ error: "No analysis yet" }, { status: 404 });
  return NextResponse.json(analysis);
}

// POST — (re)generate analysis; admin only
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let userId: string | undefined = session.user.id;
  if (!userId) {
    const email = session.user.email?.toLowerCase().trim();
    if (email) {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      userId = u?.id;
    }
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin =
    isSiteOwner(session) ||
    !!(await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }))?.isAdmin;
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const analysis = await generateDraftAnalysis(tournamentId);
    return NextResponse.json(analysis);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
