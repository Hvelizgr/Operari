'use client';

import { useCallback, useEffect, useState } from 'react';

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
 * Pulls per-step run statistics from `/api/runbooks/:id/step-stats`
 * when the editor's "Show stats" toggle is on. Stays idle when
 * disabled — the hook's enabled gate prevents an extra round-trip
 * for operators who never open the overlay.
 *
 * `refresh()` is exposed so the canvas can re-fetch after a run
 * terminates (a fresh NodeLog row has just landed and the operator
 * almost certainly wants to see it). Bumping the internal `tick`
 * counter retriggers the effect without needing a SWR-style cache.
 */
export function useStepStats(
  runbookId: string | null,
  enabled: boolean,
  sinceMs: number = 30 * 24 * 60 * 60 * 1000
): UseStepStatsResult {
  const [stats, setStats] = useState<StepStatsMap>({});
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !runbookId) {
      setStats({});
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const url = `${API_BASE}/api/runbooks/${runbookId}/step-stats?since=${sinceMs}`;
        const res = await fetch(url, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) {
          setStats({});
          return;
        }
        const body = (await res.json()) as ApiResponse;
        setStats(body.stats ?? {});
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setStats({});
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [runbookId, enabled, sinceMs, tick]);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  return { stats, loading, refresh };
}
