import type { TemplateMeta } from './strings';

/**
 * Server-side fetcher for the templates endpoint.
 *
 * The marketing pages run as React Server Components so we hit the
 * backend over the internal docker network, not through the Next
 * rewrite proxy (which is browser-only). `API_URL` is injected at
 * build time by docker-compose; the localhost fallback is only
 * useful in `next dev` against a backend started manually.
 */
const API_URL = process.env.API_URL || 'http://localhost:4000';

export async function fetchTemplates(): Promise<TemplateMeta[]> {
  try {
    const res = await fetch(`${API_URL}/api/templates`, {
      // Template list refreshes when the templates/ directory
      // changes, which is a deploy-time event, not a request-
      // time one. Cache for an hour in production.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: TemplateMeta[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

export async function fetchTemplateBySlug(slug: string): Promise<TemplateMeta | null> {
  try {
    const res = await fetch(`${API_URL}/api/templates/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: TemplateMeta };
    return body.data ?? null;
  } catch {
    return null;
  }
}
