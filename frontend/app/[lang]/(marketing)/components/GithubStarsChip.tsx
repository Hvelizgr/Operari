'use client';

import { Github, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { repo } from '@/config/repo.config';

/**
 * GitHub-stars chip — Sprint 5+ landing polish, lifted from
 * trigger.dev's hero ("14.8k | Open source"). Doubles as a CTA
 * (link to the repo) and as silent proof that we are open-source
 * with traction.
 *
 * Behaviour:
 *   - Hits the unauthenticated `/repos/:owner/:slug` REST endpoint
 *     once per page mount (Github allows 60 req/h per IP without auth,
 *     plenty for a static landing).
 *   - Caches the count in `localStorage` for 1h so SPA navigations
 *     and refreshes within the hour skip the round-trip.
 *   - On any failure (rate-limit, offline, repo private) we fall
 *     back to a star icon + "Star on GitHub" label — no broken state,
 *     no lying about the count.
 *
 * Renders nothing during SSR to avoid hydration mismatches around the
 * cached count; the post-mount client render fills it in.
 */

const CACHE_KEY = `operari:gh-stars:${repo.owner}/${repo.slug}`;
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CachedStars {
  count: number;
  fetchedAt: number;
}

function readCache(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedStars;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return typeof parsed.count === 'number' ? parsed.count : null;
  } catch {
    return null;
  }
}

function writeCache(count: number) {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedStars = { count, fetchedAt: Date.now() };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / unavailable — non-fatal */
  }
}

function formatStars(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function GithubStarsChip({ lang, className }: { lang: string; className?: string }) {
  const [stars, setStars] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const cached = readCache();
    if (cached != null) {
      setStars(cached);
      return;
    }
    const ctrl = new AbortController();
    fetch(`https://api.github.com/repos/${repo.owner}/${repo.slug}`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: ctrl.signal,
    })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { stargazers_count?: number } | null) => {
        if (!data || typeof data.stargazers_count !== 'number') return;
        setStars(data.stargazers_count);
        writeCache(data.stargazers_count);
      })
      .catch(() => {
        // Rate-limit / network / private repo — fall through to the
        // "Star on GitHub" label. Silent because this is decoration.
      });
    return () => ctrl.abort();
  }, []);

  // SSR-safe placeholder so hydration never sees a different label
  // than the server emitted. Once `mounted` flips true the client
  // render swaps in the count or the fallback.
  if (!mounted) {
    return (
      <span
        aria-hidden="true"
        className={`border-border/60 bg-card/30 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] sm:text-xs ${className ?? ''}`}
      >
        <Github className="h-3.5 w-3.5" />
        <span>—</span>
      </span>
    );
  }

  const label = stars != null ? formatStars(stars) : lang === 'es' ? 'Star' : 'Star';
  const aria =
    stars != null
      ? lang === 'es'
        ? `${stars} estrellas en GitHub`
        : `${stars} stars on GitHub`
      : lang === 'es'
        ? 'Star en GitHub'
        : 'Star on GitHub';

  return (
    <Link
      href={repo.base}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={aria}
      className={`border-border/60 bg-card/40 text-foreground/80 hover:border-primary/40 hover:bg-card/70 hover:text-foreground group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] backdrop-blur-sm transition-all sm:text-xs ${className ?? ''}`}
    >
      <Github className="h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100" />
      <span className="text-foreground font-semibold">{label}</span>
      <span className="bg-border/60 h-3 w-px" aria-hidden="true" />
      <Star className="h-3 w-3 text-amber-400/80" />
      <span className="text-muted-foreground">{lang === 'es' ? 'Open source' : 'Open source'}</span>
    </Link>
  );
}
