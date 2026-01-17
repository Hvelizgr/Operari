import useSWR from 'swr';
import { WorkflowNode, Connection } from '@nanoflow/shared';

export interface WorkflowTemplate {
    id: string;
    name: {
        en: string;
        es: string;
    };
    description: {
        en: string;
        es: string;
    };
    category: 'email' | 'data' | 'webhooks' | 'automation';
    nodes: WorkflowNode[];
    connections: Connection[];
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useTemplates() {
    const { data, error, isLoading } = useSWR<WorkflowTemplate[]>('/api/templates', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60000,
    });

    return {
        templates: data || [],
        isLoading,
        error
    };
}
