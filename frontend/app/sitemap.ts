import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Marketing-surface sitemap. Only indexable pages — the in-app routes
 * are blocked in robots.ts. Every route gets an en+es alternates block
 * so Google picks the right hreflang for the locale.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: '', changeFrequency: 'weekly' as const, priority: 1.0 },
    { path: '/product', changeFrequency: 'monthly' as const, priority: 0.95 },
    { path: '/triggers', changeFrequency: 'monthly' as const, priority: 0.9 },
    { path: '/pricing', changeFrequency: 'monthly' as const, priority: 0.9 },
    { path: '/templates', changeFrequency: 'weekly' as const, priority: 0.85 },
    { path: '/changelog', changeFrequency: 'weekly' as const, priority: 0.8 },
    { path: '/security', changeFrequency: 'monthly' as const, priority: 0.7 },
    { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.5 },
    { path: '/terms', changeFrequency: 'yearly' as const, priority: 0.5 },
    { path: '/subprocessors', changeFrequency: 'yearly' as const, priority: 0.4 },
    { path: '/contact', changeFrequency: 'monthly' as const, priority: 0.6 },
  ];

  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const route of routes) {
    for (const lang of ['en', 'es']) {
      entries.push({
        url: `${SITE_URL}/${lang}${route.path}`,
        lastModified: now,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: {
            en: `${SITE_URL}/en${route.path}`,
            es: `${SITE_URL}/es${route.path}`,
          },
        },
      });
    }
  }

  return entries;
}
