/**
 * Core workflow types shared between frontend and backend
 */

import { NodePort, NodeConfig } from './node';

// =============================================================================
// Position
// =============================================================================

export interface Position {
    x: number;
    y: number;
}

// =============================================================================
// Workflow Node
// =============================================================================

export type ExecutionState = 'idle' | 'running' | 'success' | 'error';

export interface WorkflowNode {
    id: string;
    type: string;
    position: Position;
    title: string;
    config?: NodeConfig;
    executionState?: ExecutionState;
    executionData?: unknown;
    inputs?: NodePort[];
    outputs?: NodePort[];
}

// =============================================================================
// Connection
// =============================================================================

export interface Connection {
    id: string;
    source: string;
    target: string;
    sourcePort?: number;
    targetPort?: number;
}

// =============================================================================
// Workflow Definition
// =============================================================================

export interface WorkflowDefinition {
    id?: string;
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    connections: Connection[];
    isActive?: boolean;
    schedule?: string;
    createdAt?: string;
    updatedAt?: string;
}
