import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Join the fantasy draft";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const tournament = await prisma.tournament.findFirst({
    where: { inviteToken: token },
    select: { name: true, year: true, type: true, draftDate: true },
  });

  const name = tournament?.name ?? "Fantasy Draft";
  const year = tournament?.year ?? "";
  const draftLabel = tournament?.draftDate
    ? tournament.draftDate.toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
        hour12: true, timeZoneName: "short",
      })
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #18181b 0%, #052e16 60%, #14532d 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div style={{
          position: "absolute", top: -120, right: -120,
          width: 400, height: 400,
          borderRadius: "50%",
          background: "rgba(22, 163, 74, 0.15)",
          display: "flex",
        }} />
        <div style={{
          position: "absolute", bottom: -80, left: -80,
          width: 280, height: 280,
          borderRadius: "50%",
          background: "rgba(22, 163, 74, 0.10)",
          display: "flex",
        }} />

        {/* Ball */}
        <div style={{ fontSize: 88, lineHeight: 1, display: "flex" }}>⚽</div>

        {/* You're invited label */}
        <div style={{
          marginTop: 24,
          color: "#4ade80",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          display: "flex",
        }}>
          You&apos;re invited to join
        </div>

        {/* Tournament name */}
        <div style={{
          marginTop: 12,
          color: "white",
          fontSize: 64,
          fontWeight: 900,
          textAlign: "center",
          lineHeight: 1.1,
          padding: "0 60px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
        }}>
          {name}{" "}
          <span style={{ color: "#4ade80", marginLeft: 16 }}>{year}</span>
        </div>

        {/* Draft date */}
        {draftLabel && (
          <div style={{
            marginTop: 24,
            background: "rgba(22, 163, 74, 0.2)",
            border: "1px solid rgba(74, 222, 128, 0.3)",
            borderRadius: 12,
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 24,
            paddingRight: 24,
            color: "#86efac",
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            📅 Draft: {draftLabel}
          </div>
        )}

        {/* CTA */}
        <div style={{
          marginTop: draftLabel ? 28 : 36,
          background: "#16a34a",
          borderRadius: 14,
          paddingTop: 14,
          paddingBottom: 14,
          paddingLeft: 36,
          paddingRight: 36,
          color: "white",
          fontSize: 22,
          fontWeight: 700,
          display: "flex",
        }}>
          Join the Draft →
        </div>

        {/* Branding */}
        <div style={{
          position: "absolute",
          bottom: 28,
          color: "#52525b",
          fontSize: 16,
          letterSpacing: "0.05em",
          display: "flex",
        }}>
          WorldCuppy · Fantasy Football
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
