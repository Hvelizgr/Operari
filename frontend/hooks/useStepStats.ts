'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

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
  const queryKey = ['step-stats', runbookId, sinceMs] as const;

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
    stats: data ?? {},
    loading: isFetching,
    refresh,
  };
}
