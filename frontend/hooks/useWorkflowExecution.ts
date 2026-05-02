import { useState } from 'react';

/**
 * A per-field validation issue from the backend's input validator.
 * Shape matches `backend/src/runbook/inputs/validate-run-inputs.ts`.
 */
export interface RunInputIssue {
  field: string;
  message: string;
}

export type ExecuteWorkflowResult =
  | { kind: 'ok'; executionId: string }
  | { kind: 'invalid_inputs'; issues: RunInputIssue[] }
  | { kind: 'error'; message: string };

export function useWorkflowExecution(runbookId: string | null) {
  const [executing, setExecuting] = useState(false);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeWorkflow = async (
    input: unknown = {},
    mode: 'run' | 'debug' | 'dry-run' = 'run'
  ): Promise<ExecuteWorkflowResult | undefined> => {
    if (!runbookId) return;

    setExecuting(true);
    setError(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      // Debug mode was historically meant to stop on every step, but
      // the backend /debug route was never wired. Until it is, debug
      // aliases to /run with a `debug: true` flag the backend can
      // opt into. Execution still runs to completion, matching the
      // current UX.
      //
      // Dry-run mode rides the same endpoint but flips the
      // `dryRun: true` flag; every step executor logs what it
      // WOULD do without side effects. Safe to use against prod.
      const endpoint = `${apiBase}/api/executions/${runbookId}/run`;
      const payload =
        mode === 'debug'
          ? { input, debug: true }
          : mode === 'dry-run'
            ? { input, dryRun: true }
            : { input };

      // `/api/*` is cookie-authenticated for the web UI; without
      // `credentials: 'include'` the JWT cookie is dropped and the
      // backend returns 401. Worse, in some browsers a CORS rejection
      // on the credentialless request leaves the promise pending
      // forever, freezing the toolbar in "Launching…" with no error
      // surface. Every other hook in this app already sends cookies —
      // this one was the outlier.
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // 400 with code=invalid_run_inputs carries per-field issues the
        // Run dialog renders next to the offending form fields. Any
        // other non-2xx collapses to a generic "error" kind so the
        // caller can show a banner without second-guessing the body.
        if (response.status === 400) {
          const body = (await response.json().catch(() => null)) as {
            code?: string;
            issues?: RunInputIssue[];
          } | null;
          if (body?.code === 'invalid_run_inputs' && Array.isArray(body.issues)) {
            return { kind: 'invalid_inputs', issues: body.issues };
          }
        }
        throw new Error(`Failed to start workflow execution (${mode})`);
      }

      const execution = await response.json();
      setCurrentExecutionId(execution.id);
      return { kind: 'ok', executionId: execution.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution error';
      setError(message);
      console.error('Execution error:', err);
      return { kind: 'error', message };
    } finally {
      // Note: If debugging, we might NOT want to setExecuting(false) immediately if it pauses?
      // But for now, let's keep it simple.
      setExecuting(false);
    }
  };

  const executeFromNode = async (nodeId: string, input: any = {}) => {
    if (!runbookId) return;

    setExecuting(true);
    setError(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiBase}/api/executions/${runbookId}/run`, {
        method: 'POST',
        credentials: 'include',
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
        credentials: 'include',
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
