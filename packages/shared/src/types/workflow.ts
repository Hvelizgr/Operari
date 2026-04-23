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

export interface WorkflowNode {
  id: string;
  type: string;
  position: Position;
  title: string;
  config?: Record<string, any> | NoteNodeConfig;
  executionState?: ExecutionState;
  enabled?: boolean;
  inputs?: NodePort[];
  outputs?: NodePort[];
  parentId?: string; // Reference to parent frame node for grouping
}

// =============================================================================
// Connection
// =============================================================================

export type ConnectionCondition = 'complete' | 'success' | 'error' | 'warning' | 'disabled';

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
  createdAt?: string;
  updatedAt?: string;
}
