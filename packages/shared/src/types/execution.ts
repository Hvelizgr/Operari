/**
 * Execution-related types shared between frontend and backend
 */

// =============================================================================
// Execution Status
// =============================================================================

export type ExecutionStatus =
    | 'pending'
    | 'running'
    | 'success'
    | 'error'
    | 'cancelled'
    | 'timeout';

// =============================================================================
// Execution Metrics (for dashboard/analytics)
// =============================================================================

export interface ExecutionMetric {
    nodeId: string;
    nodeName: string;
    executionTime: number;
    status: 'success' | 'error';
    timestamp: number;
}

// =============================================================================
// Node Log Entry
// =============================================================================

export interface NodeLogEntry {
    id: string;
    nodeId: string;
    nodeName: string;
    status: ExecutionStatus;
    input?: unknown;
    output?: unknown;
    error?: string;
    startedAt: string;
    finishedAt?: string;
    duration?: number;
}

// =============================================================================
// Execution Result
// =============================================================================

export interface ExecutionResult {
    id: string;
    workflowId: string;
    status: ExecutionStatus;
    startedAt: string;
    finishedAt?: string;
    duration?: number;
    nodeLogs: NodeLogEntry[];
    error?: string;
    output?: unknown;
}

// =============================================================================
// Execution Input/Output
// =============================================================================

export interface ExecutionInput {
    [key: string]: unknown;
}

export interface ExecutionOutput {
    [key: string]: unknown;
}

// =============================================================================
// Execution Context (passed between nodes during execution)
// =============================================================================

export interface ExecutionContext {
    workflowId: string;
    executionId: string;
    input: ExecutionInput;
    output: ExecutionOutput;
    variables?: Record<string, unknown>;
}
