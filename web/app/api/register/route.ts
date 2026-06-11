import { NextResponse } from "next/server";
import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";

// Simple in-memory rate limiter: max 5 attempts per IP per hour
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again in an hour." },
      { status: 429 }
    );
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      inviteToken?: string;
    };

    const inviteToken = body.inviteToken?.trim() || null;

    if (process.env.REGISTRATION_OPEN !== "true") {
      if (!inviteToken) {
        return NextResponse.json(
          { error: "Registration is closed" },
          { status: 403 }
        );
      }
      const validTournament = await prisma.tournament.findUnique({
        where: { inviteToken },
        select: { id: true },
      });
      if (!validTournament) {
        return NextResponse.json(
          { error: "Invalid or expired invite link" },
          { status: 403 }
        );
      }
    }

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
      data: { email, name, passwordHash },
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
