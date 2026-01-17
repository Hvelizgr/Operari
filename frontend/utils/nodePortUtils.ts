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
/**
 * Get port position and direction for a node
 * @param node - The workflow node
 * @param portType - 'input' or 'output'
 * @param portIndex - Index of the port (for nodes with multiple ports)
 * @param totalPorts - Total number of ports on this side (defaults to 1)
 * @returns PortInfo with x, y coordinates and direction
 */
export const getNodePortInfo = (
    node: NodeWithDimensions,
    portType: 'input' | 'output',
    portIndex: number = 0,
    totalPorts: number = 1
): PortInfo => {
    const lowerType = node.type.toLowerCase();
    const lowerCategory = (node as any).category?.toLowerCase() || '';
    const count = Math.max(1, totalPorts);

    // Trigger / Start: Output ONLY - Small 64x64 circle/pill
    if (lowerType.includes('trigger') || lowerType === 'start' || lowerCategory.includes('trigger')) {
        const { width, height } = NODE_DIMENSIONS.entity;
        if (portType === 'input') {
            return { x: node.position.x, y: node.position.y + (height / 2), direction: 'left' };
        }
        return { x: node.position.x + width, y: node.position.y + (height / 2), direction: 'right' };
    }

    // Action/Service: Input (Left) - Small 64x64 circle/pill
    if (lowerType.includes('action') || lowerType.includes('email') || lowerType.includes('slack') || lowerType.includes('discord') ||
        lowerCategory.includes('ai') || lowerCategory.includes('integrations') || lowerType.includes('openai') || lowerType.includes('anthropic')) {
        const { width, height } = NODE_DIMENSIONS.entity;
        if (portType === 'input') {
            return { x: node.position.x, y: node.position.y + (height / 2), direction: 'left' };
        }
        return { x: node.position.x + width, y: node.position.y + (height / 2), direction: 'right' };
    }

    // Controller: Input (Left), Output (Right) - 128x64 pill
    if (lowerType.includes('controller') || lowerType.includes('condition') || lowerCategory.includes('control') || lowerCategory.includes('logic')) {
        const { width, height } = NODE_DIMENSIONS.controller;
        if (portType === 'input') {
            return { x: node.position.x, y: node.position.y + (height / 2), direction: 'left' };
        }
        return { x: node.position.x + width, y: node.position.y + (height / 2), direction: 'right' };
    }

    // Limit: Input (Top), Output (Bottom) - 64x64 circle/pill
    if (lowerType.includes('limit')) {
        const { width, height } = NODE_DIMENSIONS.entity;
        if (portType === 'input') {
            return { x: node.position.x + (width / 2), y: node.position.y, direction: 'top' };
        }
        return { x: node.position.x + (width / 2), y: node.position.y + height, direction: 'bottom' };
    }

    // Standard Job (Event): Input (Left), Output (Right) with multiple ports support - 275px box
    const height = node.dimensions?.height || NODE_DIMENSIONS.event.height;
    const width = node.dimensions?.width || NODE_DIMENSIONS.event.width;

    // Calculate vertical position based on index and total count
    const yOffset = (height * (portIndex + 1)) / (count + 1);

    if (portType === 'input') {
        return { x: node.position.x, y: node.position.y + yOffset, direction: 'left' };
    }
    return { x: node.position.x + width, y: node.position.y + yOffset, direction: 'right' };
};

/**
 * Legacy function for backward compatibility - get input port position
 * @deprecated Use getNodePortInfo instead
 */
export const getNodeInputPort = (
    node: NodeWithDimensions,
    portIndex: number = 0,
    totalPorts: number = 1
): { x: number; y: number } => {
    const info = getNodePortInfo(node, 'input', portIndex, totalPorts);
    return { x: info.x, y: info.y };
};

/**
 * Legacy function for backward compatibility - get output port position
 * @deprecated Use getNodePortInfo instead
 */
export const getNodeOutputPort = (
    node: NodeWithDimensions,
    portIndex: number = 0,
    totalPorts: number = 1
): { x: number; y: number } => {
    const info = getNodePortInfo(node, 'output', portIndex, totalPorts);
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

/**
 * Math utilities for Bezier curves
 */

export const getControlPoint = (pos: { x: number, y: number }, direction: PortDirection, distance: number) => {
    switch (direction) {
        case 'left': return { x: pos.x - distance, y: pos.y };
        case 'right': return { x: pos.x + distance, y: pos.y };
        case 'top': return { x: pos.x, y: pos.y - distance };
        case 'bottom': return { x: pos.x, y: pos.y + distance };
        default: return { x: pos.x, y: pos.y };
    }
};

export const getControlPoints = (
    start: { x: number; y: number; direction: PortDirection },
    end: { x: number; y: number; direction: PortDirection }
) => {
    const distX = Math.abs(end.x - start.x);
    const distY = Math.abs(end.y - start.y);
    const dist = Math.sqrt(distX * distX + distY * distY);
    const curvature = Math.min(Math.max(dist * 0.4, 50), 200);

    const cp1 = getControlPoint(start, start.direction, curvature);
    const cp2 = getControlPoint(end, end.direction, curvature);
    return { cp1, cp2, curvature };
};

export const getBezierPoint = (t: number, p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) => {
    const c0 = Math.pow(1 - t, 3);
    const c1 = 3 * Math.pow(1 - t, 2) * t;
    const c2 = 3 * (1 - t) * Math.pow(t, 2);
    const c3 = Math.pow(t, 3);

    return {
        x: c0 * p0.x + c1 * p1.x + c2 * p2.x + c3 * p3.x,
        y: c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y
    };
};
