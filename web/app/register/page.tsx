import Link from "next/link";

import { prisma } from "@/lib/prisma";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: { invite?: string } | Promise<{ invite?: string }>;
}) {
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const inviteToken = params.invite?.trim() || null;

  let poolName: string | null = null;
  if (inviteToken) {
    const t = await prisma.tournament.findUnique({
      where: { inviteToken },
      select: { poolName: true, name: true, year: true },
    });
    if (t) poolName = t.poolName ?? `${t.name} ${t.year}`;
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Create account
          </h1>
          {poolName ? (
            <p className="mt-1 text-sm text-zinc-500">
              You&apos;ve been invited to join <span className="font-medium text-zinc-700">{poolName}</span>.
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">
              Sign up with email and password.
            </p>
          )}
        </div>

        <RegisterForm inviteToken={inviteToken} />

        <div className="text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
