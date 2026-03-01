/**
 * Core workflow types shared between frontend and backend
 */

import { NodePort, NodeConfig, NoteNodeConfig } from './node';

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

export interface NodeTest {
    id: string;
    name: string;
    condition: string; // JavaScript expression to evaluate output (e.g. "output.success === true")
    severity: 'error' | 'warning';
}

export interface WorkflowNode {
    id: string;
    type: string;
    position: Position;
    title: string;
    config?: Record<string, any> | NoteNodeConfig;
    executionState?: ExecutionState;
    enabled?: boolean;
    breakpoint?: boolean;
    pinnedData?: any; // Pinned output data for debug - skips execution and returns this data
    tests?: NodeTest[]; // Automated tests for this node
    inputs?: NodePort[];
    outputs?: NodePort[];
    parentId?: string; // Reference to parent frame node for grouping
    color?: string; // Custom color override for the node
    parameters?: Record<string, any>; // Node parameters (operation-specific)
}

// =============================================================================
// Connection
// =============================================================================

export interface ComplexCondition {
    field: string;
    operator: string;
    value: any;
}

export type ConnectionCondition = 'complete' | 'success' | 'error' | 'warning' | 'disabled' | ComplexCondition;

export interface Connection {
    id: string;
    source: string;
    target: string;
    sourcePort?: number;
    targetPort?: number;
    condition?: ConnectionCondition; // Default: 'complete' - always executes
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
    requiresApproval?: boolean;
    createdAt?: string;
    updatedAt?: string;
}
