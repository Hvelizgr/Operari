// frontend/utils/nodePortUtils.ts
// Utility functions for calculating node port positions
// Used by both EditorNode.tsx and useCanvasRenderer.ts

import type { WorkflowNode } from '@cairn/shared';

export type PortDirection = 'left' | 'right' | 'top' | 'bottom';

export interface PortInfo {
  x: number;
  y: number;
  direction: PortDirection;
}

export interface NodeWithDimensions extends WorkflowNode {
  dimensions?: { height: number; width: number };
}

// Node dimensions constants (matching CSS in WorkflowNode.css)
const NODE_DIMENSIONS = {
  entity: { width: 64, height: 64 }, // .wf_ent_trigger, .wf_ent_action, .wf_ent_limit
  controller: { width: 128, height: 64 }, // .wf_ent_controller
  event: { width: 275, height: 120 }, // .wf_event (standard job)
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
  portIndex: number = 0
): PortInfo => {
  const type = node.type.toLowerCase();

  // Trigger / Start: Output ONLY (Right side of 64x64 entity)
  // CSS: .wf_ent_trigger is 64x64, output pole at left: calc(100% + 1px), top: 50%
  if (type.includes('trigger') || type === 'start') {
    const { width, height } = NODE_DIMENSIONS.entity;
    if (portType === 'input') {
      // Triggers typically don't have input, but if needed:
      return { x: node.position.x, y: node.position.y + height / 2, direction: 'left' };
    }
    // Output is at right edge (100% + offset)
    return { x: node.position.x + width, y: node.position.y + height / 2, direction: 'right' };
  }

  // Controller: Input (Left), Output (Right) - 128x64 pill shape
  // CSS: .wf_ent_controller is 128x64
  // Matches: Condition, Switch, If, nanorun.if, nanorun.switch
  if (
    type.includes('controller') ||
    type === 'condition' ||
    type === 'switch' ||
    type === 'nanorun.switch' ||
    type === 'if' ||
    type === 'nanorun.if'
  ) {
    const { width } = NODE_DIMENSIONS.controller;
    const outputs = (node as any).outputs as Array<unknown> | undefined;
    const hasMultiOut = Array.isArray(outputs) && outputs.length > 1;
    const effectiveHeight = hasMultiOut
      ? Math.max(64, 14 + outputs!.length * 26)
      : NODE_DIMENSIONS.controller.height;

    if (portType === 'input') {
      return { x: node.position.x, y: node.position.y + effectiveHeight / 2, direction: 'left' };
    }
    // Multi-output: stacked vertically at 14 + i * 26
    if (hasMultiOut) {
      const poleY = node.position.y + 14 + portIndex * 26;
      return { x: node.position.x + width, y: poleY, direction: 'right' };
    }
    return {
      x: node.position.x + width,
      y: node.position.y + effectiveHeight / 2,
      direction: 'right',
    };
  }

  // Action: Input (Left) - 64x64 semicircle on right
  // CSS: .wf_ent_action is 64x64, input pole at left: calc(0% - 1px), top: 50%
  if (
    type.includes('action') ||
    type.includes('email') ||
    type.includes('slack') ||
    type.includes('discord')
  ) {
    const { width, height } = NODE_DIMENSIONS.entity;
    if (portType === 'input') {
      return { x: node.position.x, y: node.position.y + height / 2, direction: 'left' };
    }
    // Actions typically don't have output, but if needed:
    return { x: node.position.x + width, y: node.position.y + height / 2, direction: 'right' };
  }

  // Limit: Input (Top), Output (Bottom) - 64x64 diamond rotated 45deg
  // CSS: .wf_ent_limit is 64x64 with transform: rotate(45deg) scale(0.7)
  // Matches: Loop, Iterator, nanorun.loop, and any *limit* type
  if (type.includes('limit') || type === 'loop' || type === 'iterator' || type === 'nanorun.loop') {
    const { width, height } = NODE_DIMENSIONS.entity;
    if (portType === 'input') {
      // Input at top center
      return { x: node.position.x + width / 2, y: node.position.y, direction: 'top' };
    }
    // Output at bottom center
    return { x: node.position.x + width / 2, y: node.position.y + height, direction: 'bottom' };
  }

  // Standard Job (Event): Input (Left), Output (Right)
  // CSS: .wf_event is 275px wide, variable height
  // Poles are at left: calc(0% - 1px) and left: calc(100% + 1px), top: 50%
  const height = node.dimensions?.height || NODE_DIMENSIONS.event.height;
  const width = node.dimensions?.width || NODE_DIMENSIONS.event.width;

  if (portType === 'input') {
    return { x: node.position.x, y: node.position.y + height / 2, direction: 'left' };
  }

  // Multi-output nodes (e.g. approval with approved/rejected) stack
  // output poles vertically. EditorNode.tsx positions them at
  // `top: ${30 + i * 26}px`. When portIndex > 0 AND the node
  // declares multiple outputs, offset Y accordingly so the Bezier
  // curve starts from the correct pole, not always the center.
  const outputs = (node as any).outputs as Array<unknown> | undefined;
  const hasMultipleOutputs = Array.isArray(outputs) && outputs.length > 1;

  if (hasMultipleOutputs && portIndex > 0) {
    // First pole is at 30px from top, each subsequent pole at +26px
    const poleY = node.position.y + 30 + portIndex * 26;
    return { x: node.position.x + width, y: poleY, direction: 'right' };
  }

  // Single output or first output of multi-output: center of right edge
  // (for multi-output index 0, use 30px offset to match the first pole)
  if (hasMultipleOutputs) {
    return { x: node.position.x + width, y: node.position.y + 30, direction: 'right' };
  }

  return { x: node.position.x + width, y: node.position.y + height / 2, direction: 'right' };
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
