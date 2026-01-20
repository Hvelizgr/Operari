/**
 * Initial constants for the EditorCanvas component
 * These provide default workflow examples for new users
 */

import type { WorkflowNode, Connection } from '@nanoflow/shared';

/**
 * Default nodes shown when the editor first loads
 * Empty by default - users can add nodes or select a template
 */
export const INITIAL_NODES: WorkflowNode[] = [];

/**
 * Default connections between initial nodes
 * Empty by default - connections are created when user adds nodes
 */
export const INITIAL_CONNECTIONS: Connection[] = [];
