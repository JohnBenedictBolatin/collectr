import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.COLLECTR_BUILD_DIR || ".next-build",
  images: { remotePatterns: [] },
};

export default nextConfig;
