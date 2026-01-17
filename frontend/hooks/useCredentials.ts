
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => {
    if (!r.ok) throw new Error('Network response was not ok');
    return r.json();
});

export interface Credential {
    id: string;
    name: string;
    type: string;
    createdAt: string;
}

export function useCredentials() {
    const { data, error, isLoading, mutate } = useSWR<Credential[]>('/api/credentials', fetcher);

    const createCredential = async (name: string, type: string, data: Record<string, any>) => {
        const res = await fetch('/api/credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type, data }),
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to create credential');
        }
        mutate(); // Reload data
        return res.json();
    };

    const deleteCredential = async (id: string) => {
        const res = await fetch(`/api/credentials/${id}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete credential');
        mutate();
    };

    return {
        credentials: data || [],
        loading: isLoading,
        error,
        createCredential,
        deleteCredential,
    };
}
