import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // This will ignore ESLint errors during build
  },
  images: {
    domains: ["hmlkhbnvuhtyhytippve.supabase.co"],
  },
  /* config options here */
};

export default nextConfig;
