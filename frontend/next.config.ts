import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // output: 'standalone', // Disabled for Docker build

  // Fix for monorepo: Tell Next.js where the workspace root is
  // This prevents the "multiple lockfiles" warning and helps Turbopack
  outputFileTracingRoot: path.join(__dirname, '..'),

  turbopack: {
    // Must match outputFileTracingRoot for monorepo compatibility
    root: path.join(__dirname, '..'),
  },
  experimental: {
    // turbo config moved to root
  },
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/webhook/:path*',
        destination: `${apiUrl}/webhook/:path*`,
      },
    ];
  },
};

/**
 * Sentry wraps the next-intl-wrapped config. Source map upload is
 * gated on `SENTRY_AUTH_TOKEN` being set at build time — when the
 * token is missing the plugin silently no-ops, so self-host installs
 * without Sentry keep building unchanged.
 *
 * Order matters: next-intl must wrap first, then Sentry. Sentry's
 * docs explicitly recommend this so the auto-instrumentation hooks
 * still see the i18n-rewritten routes.
 */
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Skip the upload entirely when no auth token — keeps `next build`
  // running on dev / self-host installs without a Sentry account.
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Strip the uploaded source maps from the served bundle so end
  // users do not download them. Sentry still resolves stack frames
  // server-side using the uploaded copies.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
