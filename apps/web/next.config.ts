import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable forbidden() function for 403 responses
  experimental: {
    authInterrupts: true,
  },
  // Redirect old plugin paths to the new catch-all host routes
  async redirects() {
    return [
      {
        source: '/plugins/notes/:path*',
        destination: '/apps/notes/:path*',
        permanent: true,
      },
      {
        source: '/support/:path*',
        destination: '/apps/support/:path*',
        permanent: true,
      },
      {
        source: '/admin/support/:path*',
        destination: '/apps/support/admin/:path*',
        permanent: true,
      },
      {
        source: '/f/:path*',
        destination: '/p/apps/forms/:path*',
        permanent: true,
      },
      {
        source: '/book/:path*',
        destination: '/p/apps/calendar/:path*',
        permanent: true,
      },
    ]
  },
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
