/**
 * Initial constants for the EditorCanvas component
 * These provide default workflow examples for new users
 */

import type { WorkflowNode, Connection } from '@nanoflow/shared';

/**
 * Default nodes shown when the editor first loads
 * Demonstrates a simple webhook -> transform -> api/database workflow
 */
export const INITIAL_NODES: WorkflowNode[] = [
    {
        id: 'node-1',
        type: 'webhook',
        title: 'Webhook Trigger',
        position: { x: 100, y: 200 },
        outputs: [{ id: 'out-1', label: 'Output' }]
    },
    {
        id: 'node-2',
        type: 'script',
        title: 'Data Transform',
        position: { x: 450, y: 200 },
        inputs: [{ id: 'in-2', label: 'Input' }],
        outputs: [{ id: 'out-2', label: 'Output' }]
    },
    {
        id: 'node-3',
        type: 'request',
        title: 'External API',
        position: { x: 800, y: 100 },
        inputs: [{ id: 'in-3', label: 'Input' }],
        outputs: [{ id: 'out-3', label: 'Output' }]
    },
    {
        id: 'node-4',
        type: 'database',
        title: 'Postgres Insert',
        position: { x: 800, y: 300 },
        inputs: [{ id: 'in-4', label: 'Input' }]
    }
];

/**
 * Default connections between initial nodes
 */
export const INITIAL_CONNECTIONS: Connection[] = [
    { id: 'edge-1', source: 'node-1', target: 'node-2' },
    { id: 'edge-2', source: 'node-2', target: 'node-3' },
    { id: 'edge-3', source: 'node-2', target: 'node-4' }
];
