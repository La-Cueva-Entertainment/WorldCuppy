import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Image from "next/image";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  const playerCount = await prisma.user.count().catch(() => 0);

  return (
    <div className="flex flex-col">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 min-h-[360px] 2xl:min-h-[420px] flex items-end">
        {/* Grass shadow */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-green-900/60 to-transparent" />

        {/* Left content */}
        <div className="relative z-10 flex flex-col justify-center px-[5vw] py-12 max-w-2xl 2xl:max-w-4xl">
          <h1 className="text-5xl font-extrabold tracking-tight text-white drop-shadow-lg md:text-6xl lg:text-7xl">
            World <span className="text-yellow-400">Cuppy</span>
          </h1>
          <p className="mt-3 text-lg text-white/80 drop-shadow lg:text-xl">
            International Fantasy Fútbol - Draft Nations
          </p>
        </div>

        {/* Mobile: single character on right */}
        <div className="absolute bottom-0 right-0 h-[300px] select-none pointer-events-none md:hidden">
          <Image src="/spain3.png" alt="Spain player" width={260} height={300}
            className="h-full w-auto object-contain object-bottom" priority />
        </div>

        {/* Desktop: all characters spread out */}
        <div className="absolute bottom-0 right-[2vw] h-[330px] 2xl:h-[390px] select-none pointer-events-none hidden md:block">
          <Image src="/swedish.png" alt="Sweden player" width={310} height={330}
            className="h-full w-auto object-contain object-bottom scale-x-[-1]" priority />
        </div>
        <div className="absolute bottom-0 right-[16vw] h-[345px] 2xl:h-[405px] select-none pointer-events-none hidden md:block">
          <Image src="/brazil6.png" alt="Brazil player" width={345} height={345}
            className="h-full w-auto object-contain object-bottom" priority />
        </div>
        <div className="absolute bottom-0 right-[28vw] h-[320px] 2xl:h-[380px] select-none pointer-events-none hidden md:block">
          <Image src="/ivory5.png" alt="Ivory Coast player" width={320} height={320}
            className="h-full w-auto object-contain object-bottom" priority />
        </div>
        <div className="absolute bottom-0 right-[43vw] h-[300px] 2xl:h-[360px] select-none pointer-events-none hidden md:block">
          <Image src="/belgian.png" alt="Belgium player" width={280} height={300}
            className="h-full w-auto object-contain object-bottom" priority />
        </div>
        <div className="absolute bottom-0 right-[52vw] h-[340px] 2xl:h-[400px] select-none pointer-events-none hidden md:block">
          <Image src="/spain3.png" alt="Spain player" width={320} height={340}
            className="h-full w-auto object-contain object-bottom" priority />
        </div>
      </div>

      {/* Content below banner */}
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-600 shadow-sm">
            🗓️ World Cup · Euros · Nations League
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-600 shadow-sm">
            🐍 Fair snake draft
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-600 shadow-sm">
            📊 Live standings & earnings
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex h-12 items-center rounded-2xl bg-green-600 px-8 text-base font-bold text-white shadow-sm hover:bg-green-700"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-8 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
