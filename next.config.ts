import type { NextConfig } from "next";
import { hostname } from "os";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // This will ignore ESLint errors during build
  },
  images: {
    domains: ["hmlkhbnvuhtyhytippve.supabase.co"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.google.com",
        port: "",
        pathname: "/s2/favicons**",
      },
    ],
  },
  /* config options here */
};

export default nextConfig;
