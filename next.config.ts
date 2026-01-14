import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // turbo config moved to root
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4001/api/:path*',
      },
      {
        source: '/webhook/:path*',
        destination: 'http://localhost:4001/webhook/:path*',
      }
    ];
  },
};

export default withNextIntl(nextConfig);

