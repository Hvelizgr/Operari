import useSWR from 'swr';
import { WorkflowNode, Connection } from '@nanoflow/shared';
import { safeFetcher } from './useSWRConfig';

export interface WorkflowTemplate {
    id: string;
    name: {
        en: string;
        es: string;
    };
    description?: {
        en: string;
        es: string;
    } | null;
    category?: 'email' | 'data' | 'webhooks' | 'automation' | 'ai' | string | null;
    nodes: WorkflowNode[];
    connections: Connection[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export function useTemplates() {
    const { data, error, isLoading } = useSWR<WorkflowTemplate[]>(
        `${API_URL}/api/templates?public=true`,
        safeFetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000,
        }
    );

    return {
        templates: data || [],
        isLoading,
        error
    };
}
