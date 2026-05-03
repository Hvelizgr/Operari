'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

/**
 * Root QueryClientProvider — owns a single, app-wide query cache.
 *
 * Defaults are tuned for Operari's read patterns:
 *
 *   - `staleTime: 30s` — most reads (run history, step stats, schema
 *     metadata, accounts list) are fine to serve stale on remount.
 *     The socket layer invalidates explicitly when a state-changing
 *     event arrives, so we don't need aggressive background refetches.
 *   - `gcTime: 5min` — cached query results survive component
 *     unmounts long enough for tab switches and back navigation.
 *   - `refetchOnWindowFocus: false` — operators don't expect a
 *     refetch every time they tab back; the durable engine + socket
 *     events drive freshness explicitly. Re-enable per-query if a
 *     specific surface needs it (audit dashboards, live monitors).
 *   - `retry: 1` — most failures are tenant-scope guard violations
 *     or missing auth, neither of which a retry will fix. One retry
 *     covers transient network blips without amplifying real
 *     failures into N requests.
 *
 * The QueryClient is stored in `useState` so HMR doesn't reset the
 * cache on every save (a fresh `new QueryClient()` per render would
 * blow away the cache on every parent rerender).
 *
 * Devtools render only outside production. Bottom-left position
 * keeps them out of the editor's bottom-center run console.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV !== 'production' ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
