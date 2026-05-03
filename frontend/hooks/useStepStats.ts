'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface StepStatsRecent {
  status: 'SUCCESS' | 'FAILED';
  startedAt: string;
  durationMs: number | null;
}

export interface StepStats {
  runs: number;
  successRate: number | null;
  failureRate: number | null;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  recent: StepStatsRecent[];
}

export type StepStatsMap = Record<string, StepStats>;

interface ApiResponse {
  runbookId: string;
  sinceMs: number;
  stats: StepStatsMap;
}

interface UseStepStatsResult {
  stats: StepStatsMap;
  loading: boolean;
  refresh: () => void;
}

// Stable empty-stats sentinel. Returning `{}` inline from `stats: data
// ?? {}` would mint a fresh object reference on every render of the
// hook — Canvas.tsx then has a `useEffect(() => setStepStats(stats),
// [stats, ...])` that would re-fire every render, hit Zustand,
// trigger another render, and loop until React bails out with
// "Maximum update depth exceeded". Pinning a module-level singleton
// keeps the reference stable until react-query actually has data.
const EMPTY_STATS: StepStatsMap = {};

/**
 * Per-runbook step statistics — Sprint 1 pilot for `@tanstack/react-query`.
 *
 * Why this hook for the pilot: it's the simplest data-fetch surface
 * we have (one GET, no socket interaction, no optimistic mutations),
 * which lets the migration prove the pattern without compounding risk
 * with `useExecutionSocket`'s in-flight backfill+socket dance. Once
 * this lands cleanly, the rest of the read-only fetches (account list,
 * schema metadata, runbook GET, dashboard overview) follow the same
 * recipe.
 *
 * Behavior preserved exactly: same return shape (`{ stats, loading,
 * refresh }`), same `enabled` gate that suppresses the round-trip when
 * the operator hasn't opened the overlay, same default `sinceMs` of
 * 30 days. The `refresh()` function now invalidates the query (rather
 * than bumping a tick counter), which lets the canvas force a refetch
 * after a run terminates without re-implementing cache busting by hand.
 */
export function useStepStats(
  runbookId: string | null,
  enabled: boolean,
  sinceMs: number = 30 * 24 * 60 * 60 * 1000
): UseStepStatsResult {
  const queryClient = useQueryClient();
  // Memoised so `refresh`'s `useCallback` doesn't see a new key tuple
  // every render (which would also force consumers using `refresh` in
  // their own effect deps to re-fire). The key contents only change
  // when runbookId or sinceMs change.
  const queryKey = useMemo(() => ['step-stats', runbookId, sinceMs] as const, [runbookId, sinceMs]);

  const { data, isFetching } = useQuery({
    queryKey,
    enabled: enabled && !!runbookId,
    queryFn: async ({ signal }) => {
      const url = `${API_BASE}/api/runbooks/${runbookId}/step-stats?since=${sinceMs}`;
      const res = await fetch(url, { credentials: 'include', signal });
      if (!res.ok) return {};
      const body = (await res.json()) as ApiResponse;
      return body.stats ?? {};
    },
  });

  const refresh = useCallback(() => {
    // Invalidate marks the query stale; the next render with the
    // hook mounted refetches. If the hook is currently mounted, the
    // refetch fires immediately. Either way, no manual tick state.
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    // Module-level EMPTY_STATS singleton when react-query hasn't
    // resolved yet — see the comment on the constant for why this
    // matters. Once `data` exists it's already a stable reference
    // owned by react-query's cache.
    stats: data ?? EMPTY_STATS,
    loading: isFetching,
    refresh,
  };
}
