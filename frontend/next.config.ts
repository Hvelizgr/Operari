import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },

  outputFileTracingRoot: path.join(__dirname, '..'),

  turbopack: {
    root: path.join(__dirname, '..'),
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@heroui/react',
      'framer-motion',
      'recharts',
      '@nanoflow/shared',
      'date-fns',
      'lodash',
    ],
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

