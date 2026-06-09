import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function resolveUserId(session: Awaited<ReturnType<typeof getServerSession>>) {
  let userId = session?.user?.id;
  if (!userId) {
    const email = session?.user?.email?.toLowerCase().trim();
    if (email) {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      userId = u?.id;
    }
  }
  return userId;
}

// POST /api/push — subscribe
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = await resolveUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/push — unsubscribe
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = await resolveUserId(session);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { endpoint?: string };
  if (!body.endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId },
  });

  return NextResponse.json({ ok: true });
}
