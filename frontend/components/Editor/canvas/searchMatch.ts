import type { RfNode } from '@/lib/canvas/adapter';

import { resolvePreview } from './nodes/nodeChrome';

export interface SearchMatch {
  id: string;
  title: string;
  preview: string | null;
  type: string;
}

/**
 * Substring search across node title and primary config preview.
 * Lowercase comparison, trimmed query. Returned in stable input order
 * so arrow navigation feels predictable.
 *
 * Pure function so the search palette can be tested in isolation
 * without mounting React Flow.
 */
export const searchNodes = (query: string, nodes: RfNode[]): SearchMatch[] => {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const out: SearchMatch[] = [];
  for (const n of nodes) {
    if (n.type === 'custom.frame' || n.type === 'custom.note') continue;
    const title = n.data.workflow.title?.trim() ?? '';
    const config = n.data.workflow.config as Record<string, unknown> | undefined;
    const preview = resolvePreview(n.type ?? '', config);
    const haystack = `${title} ${preview ?? ''} ${n.type ?? ''}`.toLowerCase();
    if (haystack.includes(q)) {
      out.push({ id: n.id, title, preview, type: n.type ?? 'unknown' });
    }
  }
  return out;
};
