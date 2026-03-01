import useSWR from 'swr';
import { useSWRConfig } from 'swr';

export interface WorkflowApproval {
    id: string;
    workflowId: string;
    requesterId: string;
    reviewerId?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    requestType: 'ACTIVATION' | 'DEPLOYMENT';
    comment?: string;
    reviewerComment?: string;
    createdAt: string;
    updatedAt: string;
    workflow: {
        name: string;
        description?: string;
    };
    requester: {
        name?: string;
        email: string;
    };
}

export function useApprovals() {
    const { mutate } = useSWRConfig();
    const { data: pendingApprovals, error, isLoading } = useSWR<WorkflowApproval[]>('/api/approvals/pending');

    const reviewApproval = async (id: string, status: 'APPROVED' | 'REJECTED', reviewerComment?: string) => {
        const response = await fetch(`/api/approvals/${id}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, reviewerComment }),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to review approval');
        }

        // Refresh pending list
        mutate('/api/approvals/pending');
        return response.json();
    };

    const requestApproval = async (workflowId: string, requestType: 'ACTIVATION' | 'DEPLOYMENT', comment?: string) => {
        const response = await fetch('/api/approvals/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workflowId, requestType, comment }),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to request approval');
        }

        mutate('/api/approvals/pending');
        return response.json();
    };

    return {
        pendingApprovals,
        loading: isLoading,
        error,
        reviewApproval,
        requestApproval,
    };
}
