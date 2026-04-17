import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Internal app surface — not meant for indexing.
        disallow: [
          '/en/editor',
          '/es/editor',
          '/en/dashboard',
          '/es/dashboard',
          '/en/runs',
          '/es/runs',
          '/en/runbooks',
          '/es/runbooks',
          '/en/admin',
          '/es/admin',
          '/en/settings',
          '/es/settings',
          '/en/inbox',
          '/es/inbox',
          '/en/chat',
          '/es/chat',
          '/en/agents',
          '/es/agents',
          '/en/schedules',
          '/es/schedules',
          '/en/monitors',
          '/es/monitors',
          '/en/events',
          '/es/events',
          '/en/utilities',
          '/es/utilities',
          '/en/sql-editor',
          '/es/sql-editor',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
