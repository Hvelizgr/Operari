import { useState } from 'react';

export function useWorkflowExecution(workflowId: string | null) {
    const [executing, setExecuting] = useState(false);
    const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const executeWorkflow = async (input: any = {}, mode: 'run' | 'debug' = 'run') => {
        if (!workflowId) return;

        setExecuting(true);
        setError(null);

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
            const endpoint = mode === 'debug' ? `${apiBase}/api/executions/${workflowId}/debug` : `${apiBase}/api/executions/${workflowId}/run`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input }),
            });

            if (!response.ok) {
                // Determine if it was a 404 because debug endpoint is missing (common in dev), fallback to run?
                // No, just throw error for now.
                throw new Error(`Failed to start workflow execution (${mode})`);
            }

            const execution = await response.json();
            setCurrentExecutionId(execution.id);
            return execution;
        } catch (err: any) {
            setError(err.message);
            console.error('Execution error:', err);
        } finally {
            // Note: If debugging, we might NOT want to setExecuting(false) immediately if it pauses?
            // But for now, let's keep it simple.
            setExecuting(false);
        }
    };

    const executeFromNode = async (nodeId: string, input: any = {}) => {
        if (!workflowId) return;

        setExecuting(true);
        setError(null);

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
            const response = await fetch(`${apiBase}/api/executions/${workflowId}/run`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input, startNodeId: nodeId }),
            });

            if (!response.ok) {
                throw new Error('Failed to start execution from node');
            }

            const execution = await response.json();
            setCurrentExecutionId(execution.id);
            return execution;
        } catch (err: any) {
            setError(err.message);
            console.error('Execute from node error:', err);
        } finally {
            setExecuting(false);
        }
    };

    const replayNode = async (executionId: string, nodeId: string) => {
        setExecuting(true);
        setError(null);

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
            const response = await fetch(`${apiBase}/api/executions/${executionId}/replay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nodeId }),
            });

            if (!response.ok) {
                throw new Error('Failed to replay node');
            }

            const execution = await response.json();
            setCurrentExecutionId(execution.id);
            return execution;
        } catch (err: any) {
            setError(err.message);
            console.error('Replay error:', err);
        } finally {
            setExecuting(false);
        }
    };

    return {
        executeWorkflow,
        executeFromNode,
        replayNode,
        executing,
        currentExecutionId,
        error,
        setCurrentExecutionId,
    };
}
