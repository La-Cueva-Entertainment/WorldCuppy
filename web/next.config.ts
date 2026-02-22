import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: "/world-cuppy-ball.png",
        search: "?v=2026-02-21",
      },
    ],
  },
};

export default nextConfig;
