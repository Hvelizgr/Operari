import type { RfNode } from '@/lib/canvas/adapter';

import { resolvePreview } from './nodes/nodeChrome';

export interface SearchMatch {
  id: string;
  title: string;
  preview: string | null;
  type: string;
  /** n-gram score; higher = more relevant. Used to rank matches so
   *  the best one ends up first and Enter does the right thing. */
  score: number;
}

const LETTER = /[a-z]/i;

const isBoundary = (s: string, index: number): boolean => {
  if (index === 0) return true;
  return !LETTER.test(s[index - 1]);
};

/**
 * Score a haystack against a query.
 *
 * Two phases:
 *   1. Substring gate — the haystack must contain the full query as a
 *      case-insensitive substring. Pure substring is the right filter
 *      for a small catalog (~10 step types) and avoids the noisy false
 *      positives an unbounded n-gram score produces on short queries.
 *      `'ssh'` will not match `'http_request'` just because the
 *      letters happen to overlap.
 *   2. N-gram ranking — among haystacks that pass the gate, score with
 *      overlapping 2/3/4-grams (chaiNNer's tiers: 1/3/10 pts) and a
 *      boundary multiplier (3×). The result is normalized by haystack
 *      length so short, focused names ("HTTP request") rank over
 *      diluted long ones.
 *
 * A perfect-prefix match always beats a sub-string match because the
 * query's leading n-grams sit on the boundary at index 0.
 */
export const ngramScore = (query: string, haystack: string): number => {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return 0;
  const h = haystack.toLowerCase();
  // Substring gate — eliminates the unrelated "every short query
  // matches everything" failure mode.
  if (!h.includes(q)) return 0;
  if (q.length === 1) {
    // Single-char query passed the gate already; rank by length.
    return 1 / Math.max(h.length, 1);
  }

  const G2 = 1;
  const G3 = 3;
  const G4 = 10;

  const countMatches = (n: number): { matches: number; boundary: number } => {
    let matches = 0;
    let boundary = 0;
    for (let i = 0; i <= q.length - n; i += 1) {
      const idx = h.indexOf(q.slice(i, i + n));
      if (idx === -1) continue;
      if (isBoundary(h, idx)) boundary += 1;
      else matches += 1;
    }
    return { matches, boundary };
  };

  const tier = (m: { matches: number; boundary: number }, base: number): number =>
    m.matches * base + m.boundary * base * 3;

  const total = tier(countMatches(2), G2) + tier(countMatches(3), G3) + tier(countMatches(4), G4);
  // Floor at 1 so a haystack that passes the substring gate but
  // happens to score 0 in the n-gram tier (very short query) still
  // ranks above zero.
  return Math.max(total, 1) / Math.max(h.length, 1);
};

/**
 * Search across node title + primary config preview + type id, ranked
 * by n-gram score. Returns matches sorted best-first so Enter on the
 * first row is always the most relevant pick. Frame and note nodes
 * are filtered (not steps).
 */
export const searchNodes = (query: string, nodes: RfNode[]): SearchMatch[] => {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const scored: SearchMatch[] = [];
  for (const n of nodes) {
    if (n.type === 'custom.frame' || n.type === 'custom.note') continue;
    const title = n.data.workflow.title?.trim() ?? '';
    const config = n.data.workflow.config as Record<string, unknown> | undefined;
    const preview = resolvePreview(n.type ?? '', config);
    const haystack = `${title} ${preview ?? ''} ${n.type ?? ''}`;
    const score = ngramScore(q, haystack);
    if (score > 0) {
      scored.push({ id: n.id, title, preview, type: n.type ?? 'unknown', score });
    }
  }
  // Sort descending by score, stable on ties (sorted is stable in v8/Node).
  scored.sort((a, b) => b.score - a.score);
  return scored;
};

/**
 * Catalog-side variant: returns the indices in input order whose
 * haystack scores >0, sorted by score. Lets PaneNodeMenu rank step
 * types by query without restructuring the catalog.
 */
export interface RankedItem<T> {
  item: T;
  score: number;
}

export const rankByQuery = <T>(
  query: string,
  items: readonly T[],
  toHaystack: (item: T) => string
): RankedItem<T>[] => {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    // Empty query: return items as-is with score 0 so consumers can
    // distinguish "no ranking applied" and keep input order.
    return items.map(item => ({ item, score: 0 }));
  }
  const out: RankedItem<T>[] = [];
  for (const item of items) {
    const score = ngramScore(q, toHaystack(item));
    if (score > 0) out.push({ item, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
};
