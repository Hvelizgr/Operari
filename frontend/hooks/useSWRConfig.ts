import useSWR, { SWRConfiguration } from 'swr';

export const safeFetcher = async (url: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nanoflow_token') : null;
    const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
        const error = new Error(`Fetch failed: ${res.status} ${res.statusText}`);
        (error as any).status = res.status;
        throw error;
    }
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        throw new Error('Invalid JSON response');
    }
};

const defaultFetcher = safeFetcher;

export const swrConfig: SWRConfiguration = {
    fetcher: defaultFetcher,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
    errorRetryCount: 3,
    errorRetryInterval: 1000,
};

interface UseApiOptions extends SWRConfiguration {
    skip?: boolean;
}

export function useApi<T = any>(
    key: string | null,
    options?: UseApiOptions
) {
    const { skip, ...swrOptions } = options || {};
    
    return useSWR<T>(
        skip ? null : key,
        defaultFetcher,
        {
            ...swrConfig,
            ...swrOptions,
        }
    );
}

export function useApiWithRefresh<T = any>(
    key: string | null,
    refreshInterval: number = 30000,
    options?: UseApiOptions
) {
    return useApi<T>(key, {
        ...options,
        refreshInterval,
    });
}

export const cacheKeys = {
    workflows: '/api/workflows',
    workflow: (id: string) => `/api/workflows/${id}`,
    executions: '/api/executions',
    execution: (id: string) => `/api/executions/${id}`,
    analytics: '/api/analytics',
    dashboard: '/api/analytics/dashboard',
    usage: '/api/analytics/usage',
    credentials: '/api/credentials',
    nodeTypes: '/api/node-types',
    templates: '/api/templates',
};
