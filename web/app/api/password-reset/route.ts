import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Rate limit: 3 requests per email per hour (in-memory, resets on restart)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(key);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + TOKEN_EXPIRY_MS });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  if (action === "request") {
    const { email } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();

    if (!checkRateLimit(normalized)) {
      // Return 200 to avoid leaking whether account exists
      return NextResponse.json({ ok: true });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, email: true },
    });

    // Always return ok — don't reveal whether email is registered
    if (user?.email) {
      const token = randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, resetUrl).catch(() => {
        // Swallow send errors — token is created, user can retry
      });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "confirm") {
    const { token, password } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash: hash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
