import { useState } from 'react';
import { apiFetch } from '../utils/api';
import { WorkflowNode, Connection } from '@nanoflow/shared';

export interface AISuggestion {
    nodeType: string;
    reason: string;
    configPreview?: Record<string, any>;
}

export interface WorkflowDocumentation {
    summary: string;
    useCases: string[];
    prerequisites: string[];
    nodesDescription: Array<{ nodeId: string; description: string }>;
    dataFlow: string;
}

export interface FailurePrediction {
    nodeId: string;
    riskLevel: 'high' | 'medium' | 'low';
    potentialIssue: string;
    recommendation: string;
}

export interface WorkflowOptimization {
    type: 'performance' | 'reliability' | 'cost' | 'simplicity';
    description: string;
    impact: string;
    actionableFix?: string;
}

export function useAI() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const suggestNextNode = async (
        nodes: WorkflowNode[],
        connections: Connection[],
        lastNodeId?: string,
        lang: string = 'en'
    ): Promise<AISuggestion[]> => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch('/api/ai/suggest-next-node', {
                method: 'POST',
                body: JSON.stringify({ nodes, connections, lastNodeId, lang }),
            });
            return data;
        } catch (err: any) {
            setError(err.message || 'Failed to get suggestions');
            return [];
        } finally {
            setLoading(false);
        }
    };

    const generateDocumentation = async (
        nodes: WorkflowNode[],
        connections: Connection[],
        lang: string = 'en'
    ): Promise<WorkflowDocumentation | null> => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch('/api/ai/generate-docs', {
                method: 'POST',
                body: JSON.stringify({ nodes, connections, lang }),
            });
            return data;
        } catch (err: any) {
            setError(err.message || 'Failed to generate documentation');
            return null;
        } finally {
            setLoading(false);
        }
    };

    const predictFailures = async (
        nodes: WorkflowNode[],
        connections: Connection[],
        lang: string = 'en'
    ): Promise<FailurePrediction[]> => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch('/api/ai/predict-failures', {
                method: 'POST',
                body: JSON.stringify({ nodes, connections, lang }),
            });
            return data;
        } catch (err: any) {
            setError(err.message || 'Failed to predict failures');
            return [];
        } finally {
            setLoading(false);
        }
    };

    const suggestOptimizations = async (
        nodes: WorkflowNode[],
        connections: Connection[],
        lang: string = 'en'
    ): Promise<WorkflowOptimization[]> => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch('/api/ai/suggest-optimizations', {
                method: 'POST',
                body: JSON.stringify({ nodes, connections, lang }),
            });
            return data;
        } catch (err: any) {
            setError(err.message || 'Failed to suggest optimizations');
            return [];
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        suggestNextNode,
        generateDocumentation,
        predictFailures,
        suggestOptimizations,
    };
}
