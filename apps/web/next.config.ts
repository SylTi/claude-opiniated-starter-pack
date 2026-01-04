import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
