/**
 * Centralised query-key factory for `@tanstack/react-query`.
 *
 * Keys are stable tuples so different surfaces (e.g. RunDetail and
 * useExecutionSocket both reading `/api/runs/:id`) hit the same cache
 * entry. Co-locating helpers here means renaming a key updates every
 * consumer at once instead of grepping for `['runs', ...]` literals.
 */
export const queryKeys = {
  run: (runId: string) => ['runs', runId] as const,
  stepStats: (runbookId: string, sinceMs: number) => ['step-stats', runbookId, sinceMs] as const,
  runHistory: (runbookId: string | null) => ['run-history', runbookId] as const,
};
