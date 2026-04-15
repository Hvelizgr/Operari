/**
 * Initial constants for the EditorCanvas component
 * These provide default workflow examples for new users
 */

import type { WorkflowNode, Connection } from '@cairn/shared';

/**
 * Default nodes shown when the editor first loads. A single `shell`
 * step — the most common starting point for a runbook. The previous
 * default was a 4-node n8n-style demo (webhook → script → request →
 * database) using node types that have NO backend executor in NanoRun;
 * any operator who hit Run on the default got "Unknown node type".
 *
 * Keeping this minimal also matches the runbook spec model: every real
 * runbook has at least one step, and the starter is now a step that
 * actually runs.
 */
export const INITIAL_NODES: WorkflowNode[] = [
    {
        id: 'node-1',
        type: 'shell',
        title: 'Shell command',
        position: { x: 200, y: 200 },
        outputs: [{ id: 'out-1', label: 'Output' }],
    },
];

/**
 * Default connections between initial nodes
 */
export const INITIAL_CONNECTIONS: Connection[] = [];
