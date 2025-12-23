import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config to use Turbopack (Next.js 16 default)
  turbopack: {},
  // Enable polling for file watching on WSL2 with Windows filesystem (webpack fallback)
  webpack: (config) => {
    config.watchOptions = {
      poll: 15000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

export default nextConfig;
