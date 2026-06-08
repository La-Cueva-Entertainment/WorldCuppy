import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js inline scripts & RSC hydration
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind / global CSS inline styles
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Google Fonts, flag-icons CDN, Fox Sports images, flagcdn
      "img-src 'self' data: blob: https://flagcdn.com https://media.foxsports.com https://images.foxsports.com https://images2.minutemediacdn.com https://a.espncdn.com https://ichef.bbci.co.uk",
      "font-src 'self' https://fonts.gstatic.com",
      // Fox Sports RSS, football-data.org API, Discord webhook
      "connect-src 'self' https://api.foxsports.com https://api.football-data.org https://discord.com",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  headers() {
    return Promise.resolve([
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]);
  },
};

export default nextConfig;
