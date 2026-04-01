import { NextResponse } from "next/server";
import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  // Block registration unless REGISTRATION_OPEN=true is set.
  // For a private friend group you leave this unset and create accounts manually
  // via the admin panel or by setting the env var temporarily.
  if (process.env.REGISTRATION_OPEN !== "true") {
    return NextResponse.json(
      { error: "Registration is closed" },
      { status: 403 }
    );
  }

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

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
