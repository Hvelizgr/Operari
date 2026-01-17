import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // output: 'standalone', // Disabled for Docker build

  // Fix for monorepo: Tell Next.js where the workspace root is
  // This prevents the "multiple lockfiles" warning and helps Turbopack
  outputFileTracingRoot: path.join(__dirname, '..'),

  turbopack: {
    // Must match outputFileTracingRoot for monorepo compatibility
    root: path.join(__dirname, '..'),
  },
  experimental: {
    // optimizePackageImports automatically tree-shakes barrel files
    // drastically improving dev server start and build times.
    optimizePackageImports: ['lucide-react', '@nanoflow/shared', 'date-fns', 'lodash'],
  },
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:4001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/webhook/:path*',
        destination: `${apiUrl}/webhook/:path*`,
      }
    ];
  },
};

export default withNextIntl(nextConfig);

