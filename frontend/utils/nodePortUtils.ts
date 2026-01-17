// frontend/utils/nodePortUtils.ts
// Utility functions for calculating node port positions
// Used by both EditorNode.tsx and useCanvasRenderer.ts

import type { WorkflowNode } from '@nanoflow/shared';

export type PortDirection = 'left' | 'right' | 'top' | 'bottom';

// n8n-style port types
export type PortType = 'main' | 'data' | 'error' | 'config';

export interface PortInfo {
    x: number;
    y: number;
    direction: PortDirection;
}

// Advanced port definition (n8n-style)
export interface AdvancedPort {
    id: string;
    type: PortType;
    direction: PortDirection;
    label?: string;
    required?: boolean;
    color?: string;
    index: number;
}

export interface NodeWithDimensions extends WorkflowNode {
    dimensions?: { height: number; width: number };
}

// Port type colors (n8n-style) - CSS classes use these via .port-main, .port-data, etc.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PORT_TYPE_COLORS: Record<PortType, string> = {
    main: 'var(--theme-color)',      // Blue - main flow
    data: 'var(--green)',            // Green - data transfer
    error: 'var(--red)',             // Red - error handling
    config: 'var(--purple)',         // Purple - configuration
};

// Port type labels - for reference
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PORT_TYPE_LABELS: Record<PortType, string> = {
    main: 'Main',
    data: 'Data',
    error: 'Error',
    config: 'Config',
};

/**
 * Get default ports for a node type
 * @param nodeType - The node type string
 * @returns Object with input and output port configurations
 */
export const getDefaultPorts = (nodeType: string): { inputs: AdvancedPort[]; outputs: AdvancedPort[] } => {
    const type = nodeType.toLowerCase();

    // Trigger nodes: only output (main)
    if (type.includes('trigger') || type === 'start') {
        return {
            inputs: [],
            outputs: [
                { id: 'out-main-0', type: 'main', direction: 'right', label: 'Output', required: false, index: 0 }
            ]
        };
    }

    // Controller/Condition nodes: input + multiple outputs (true/false or multiple branches)
    if (type.includes('controller') || type === 'condition' || type.includes('if') || type.includes('switch')) {
        return {
            inputs: [
                { id: 'in-main-0', type: 'main', direction: 'left', label: 'Input', required: true, index: 0 }
            ],
            outputs: [
                { id: 'out-main-0', type: 'main', direction: 'right', label: 'True', required: false, index: 0 },
                { id: 'out-main-1', type: 'main', direction: 'right', label: 'False', required: false, index: 1 },
            ]
        };
    }

    // Action nodes: input only (main) + optional error output
    if (type.includes('action') || type.includes('email') || type.includes('slack') || type.includes('discord')) {
        return {
            inputs: [
                { id: 'in-main-0', type: 'main', direction: 'left', label: 'Input', required: true, index: 0 }
            ],
            outputs: [
                { id: 'out-error-0', type: 'error', direction: 'bottom', label: 'Error', required: false, index: 0 }
            ]
        };
    }

    // Transform nodes: input + output (main) + optional data ports
    if (type.includes('transform') || type.includes('set') || type.includes('merge') || type.includes('split')) {
        return {
            inputs: [
                { id: 'in-main-0', type: 'main', direction: 'left', label: 'Input', required: true, index: 0 },
                { id: 'in-data-0', type: 'data', direction: 'top', label: 'Data', required: false, index: 0 }
            ],
            outputs: [
                { id: 'out-main-0', type: 'main', direction: 'right', label: 'Output', required: false, index: 0 }
            ]
        };
    }

    // AI/LLM nodes: input + config + output + error
    if (type.includes('ai') || type.includes('llm') || type.includes('gpt') || type.includes('embedding')) {
        return {
            inputs: [
                { id: 'in-main-0', type: 'main', direction: 'left', label: 'Input', required: true, index: 0 },
                { id: 'in-config-0', type: 'config', direction: 'top', label: 'Model', required: false, index: 0 }
            ],
            outputs: [
                { id: 'out-main-0', type: 'main', direction: 'right', label: 'Output', required: false, index: 0 },
                { id: 'out-error-0', type: 'error', direction: 'bottom', label: 'Error', required: false, index: 0 }
            ]
        };
    }

    // Default: standard input/output
    return {
        inputs: [
            { id: 'in-main-0', type: 'main', direction: 'left', label: 'Input', required: true, index: 0 }
        ],
        outputs: [
            { id: 'out-main-0', type: 'main', direction: 'right', label: 'Output', required: false, index: 0 }
        ]
    };
};

/**
 * Calculate port position based on direction, index, and total count
 * @param nodePosition - Node position {x, y}
 * @param nodeDimensions - Node dimensions {width, height}
 * @param port - Port configuration
 * @param totalPortsInDirection - Total ports in the same direction
 * @returns Position {x, y}
 */
export const calculatePortPosition = (
    nodePosition: { x: number; y: number },
    nodeDimensions: { width: number; height: number },
    port: AdvancedPort,
    totalPortsInDirection: number
): { x: number; y: number } => {
    const { width, height } = nodeDimensions;
    const spacing = 20; // Spacing between ports
    const offset = (port.index - (totalPortsInDirection - 1) / 2) * spacing;

    switch (port.direction) {
        case 'left':
            return {
                x: nodePosition.x,
                y: nodePosition.y + height / 2 + offset
            };
        case 'right':
            return {
                x: nodePosition.x + width,
                y: nodePosition.y + height / 2 + offset
            };
        case 'top':
            return {
                x: nodePosition.x + width / 2 + offset,
                y: nodePosition.y
            };
        case 'bottom':
            return {
                x: nodePosition.x + width / 2 + offset,
                y: nodePosition.y + height
            };
        default:
            return { x: nodePosition.x, y: nodePosition.y };
    }
};

// Node dimensions constants (matching CSS in WorkflowNode.css)
const NODE_DIMENSIONS = {
    entity: { width: 64, height: 64 },        // .wf_ent_trigger, .wf_ent_action, .wf_ent_limit
    controller: { width: 128, height: 64 },   // .wf_ent_controller
    event: { width: 275, height: 120 },       // .wf_event (standard job)
};

/**
 * Get port position and direction for a node
 * @param node - The workflow node
 * @param portType - 'input' or 'output'
 * @param portIndex - Index of the port (for nodes with multiple ports)
 * @returns PortInfo with x, y coordinates and direction
 */
export const getNodePortInfo = (
    node: NodeWithDimensions,
    portType: 'input' | 'output',
    _portIndex: number = 0 // Reserved for future multi-port support
): PortInfo => {
    const type = node.type.toLowerCase();

    // Trigger / Start: Output ONLY (Right side of 64x64 entity)
    // CSS: .wf_ent_trigger is 64x64, output pole at left: calc(100% + 1px), top: 50%
    if (type.includes('trigger') || type === 'start') {
        const { width, height } = NODE_DIMENSIONS.entity;
        if (portType === 'input') {
            // Triggers typically don't have input, but if needed:
            return { x: node.position.x, y: node.position.y + (height / 2), direction: 'left' };
        }
        // Output is at right edge (100% + offset)
        return { x: node.position.x + width, y: node.position.y + (height / 2), direction: 'right' };
    }

    // Controller: Input (Left), Output (Right) - 128x64 pill shape
    // CSS: .wf_ent_controller is 128x64
    if (type.includes('controller') || type === 'condition') {
        const { width, height } = NODE_DIMENSIONS.controller;
        if (portType === 'input') {
            return { x: node.position.x, y: node.position.y + (height / 2), direction: 'left' };
        }
        return { x: node.position.x + width, y: node.position.y + (height / 2), direction: 'right' };
    }

    // Action: Input (Left) - 64x64 semicircle on right
    // CSS: .wf_ent_action is 64x64, input pole at left: calc(0% - 1px), top: 50%
    if (type.includes('action') || type.includes('email') || type.includes('slack') || type.includes('discord')) {
        const { width, height } = NODE_DIMENSIONS.entity;
        if (portType === 'input') {
            return { x: node.position.x, y: node.position.y + (height / 2), direction: 'left' };
        }
        // Actions typically don't have output, but if needed:
        return { x: node.position.x + width, y: node.position.y + (height / 2), direction: 'right' };
    }

    // Limit: Input (Top), Output (Bottom) - 64x64 diamond rotated 45deg
    // CSS: .wf_ent_limit is 64x64 with transform: rotate(45deg) scale(0.7)
    // The visual center remains the same, but poles are at top/bottom
    if (type.includes('limit')) {
        const { width, height } = NODE_DIMENSIONS.entity;
        if (portType === 'input') {
            // Input at top center
            return { x: node.position.x + (width / 2), y: node.position.y, direction: 'top' };
        }
        // Output at bottom center
        return { x: node.position.x + (width / 2), y: node.position.y + height, direction: 'bottom' };
    }

    // Standard Job (Event): Input (Left), Output (Right)
    // CSS: .wf_event is 275px wide, variable height
    // Poles are at left: calc(0% - 1px) and left: calc(100% + 1px), top: 50%
    const height = node.dimensions?.height || NODE_DIMENSIONS.event.height;
    const width = node.dimensions?.width || NODE_DIMENSIONS.event.width;

    if (portType === 'input') {
        return { x: node.position.x, y: node.position.y + (height / 2), direction: 'left' };
    }
    return { x: node.position.x + width, y: node.position.y + (height / 2), direction: 'right' };
};

/**
 * Legacy function for backward compatibility - get input port position
 * @deprecated Use getNodePortInfo instead
 */
export const getNodeInputPort = (
    node: NodeWithDimensions,
    portIndex: number = 0
): { x: number; y: number } => {
    const info = getNodePortInfo(node, 'input', portIndex);
    return { x: info.x, y: info.y };
};

/**
 * Legacy function for backward compatibility - get output port position
 * @deprecated Use getNodePortInfo instead
 */
export const getNodeOutputPort = (
    node: NodeWithDimensions,
    portIndex: number = 0
): { x: number; y: number } => {
    const info = getNodePortInfo(node, 'output', portIndex);
    return { x: info.x, y: info.y };
};

/**
 * Check if a connection already exists between two nodes
 * @param connections - Array of existing connections
 * @param sourceId - Source node ID
 * @param targetId - Target node ID
 * @param sourcePort - Source port index (optional)
 * @param targetPort - Target port index (optional)
 * @returns true if connection exists
 */
export const connectionExists = (
    connections: Array<{ source: string; target: string; sourcePort?: number; targetPort?: number }>,
    sourceId: string,
    targetId: string,
    sourcePort?: number,
    targetPort?: number
): boolean => {
    return connections.some(conn => {
        const sameNodes = conn.source === sourceId && conn.target === targetId;
        if (sourcePort !== undefined && targetPort !== undefined) {
            return sameNodes && conn.sourcePort === sourcePort && conn.targetPort === targetPort;
        }
        return sameNodes;
    });
};

/**
 * Validate if a connection can be created
 * @param sourceId - Source node ID
 * @param targetId - Target node ID
 * @param connections - Existing connections
 * @returns Object with isValid boolean and optional error message
 */
export const validateConnection = (
    sourceId: string,
    targetId: string,
    connections: Array<{ source: string; target: string; sourcePort?: number; targetPort?: number }>
): { isValid: boolean; error?: string } => {
    // Cannot connect to self
    if (sourceId === targetId) {
        return { isValid: false, error: 'Cannot connect a node to itself' };
    }

    // Check for duplicate connection
    if (connectionExists(connections, sourceId, targetId)) {
        return { isValid: false, error: 'Connection already exists between these nodes' };
    }

    return { isValid: true };
};
