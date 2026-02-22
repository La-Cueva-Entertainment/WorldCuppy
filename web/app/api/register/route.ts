import { NextResponse } from "next/server";
import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };

    const email = body.email?.toLowerCase().trim();
    const password = body.password;
    const name = body.name?.trim() || null;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });

    const invites = await prisma.leagueInvite.findMany({
      where: {
        email,
        acceptedAt: null,
        league: { deletedAt: null },
      },
      select: { id: true, leagueId: true },
    });

    if (invites.length > 0) {
      await prisma.$transaction([
        ...invites.map((inv) =>
          prisma.leagueMember.upsert({
            where: {
              leagueId_userId: {
                leagueId: inv.leagueId,
                userId: user.id,
              },
            },
            update: {},
            create: {
              leagueId: inv.leagueId,
              userId: user.id,
              role: "member",
            },
          })
        ),
        ...invites.map((inv) =>
          prisma.leagueInvite.update({
            where: { id: inv.id },
            data: { acceptedAt: new Date() },
          })
        ),
        prisma.user.updateMany({
          where: { id: user.id, activeLeagueId: null },
          data: { activeLeagueId: invites[0].leagueId },
        }),
      ]);
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
