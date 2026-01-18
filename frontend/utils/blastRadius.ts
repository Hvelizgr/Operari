/**
 * Blast Radius Utilities
 * Calculates downstream and upstream nodes affected by a selected node
 */

import type { Connection } from '@nanoflow/shared';

export interface BlastRadiusResult {
    downstream: Set<string>;    // Nodes affected if this node changes (río abajo)
    upstream: Set<string>;      // Nodes that this node depends on (río arriba)
    directDownstream: Set<string>;  // Immediate children
    directUpstream: Set<string>;    // Immediate parents
}

/**
 * Get all downstream nodes (nodes that would be affected if the selected node changes)
 * Uses BFS to traverse the graph
 */
export function getDownstreamNodes(nodeId: string, connections: Connection[]): Set<string> {
    const downstream = new Set<string>();
    const queue = [nodeId];
    const visited = new Set<string>([nodeId]);

    while (queue.length > 0) {
        const current = queue.shift()!;

        // Find all connections where current is the source
        const outgoing = connections.filter(c => c.source === current);

        for (const conn of outgoing) {
            if (!visited.has(conn.target)) {
                visited.add(conn.target);
                downstream.add(conn.target);
                queue.push(conn.target);
            }
        }
    }

    return downstream;
}

/**
 * Get all upstream nodes (nodes that the selected node depends on)
 * Uses BFS to traverse the graph in reverse
 */
export function getUpstreamNodes(nodeId: string, connections: Connection[]): Set<string> {
    const upstream = new Set<string>();
    const queue = [nodeId];
    const visited = new Set<string>([nodeId]);

    while (queue.length > 0) {
        const current = queue.shift()!;

        // Find all connections where current is the target
        const incoming = connections.filter(c => c.target === current);

        for (const conn of incoming) {
            if (!visited.has(conn.source)) {
                visited.add(conn.source);
                upstream.add(conn.source);
                queue.push(conn.source);
            }
        }
    }

    return upstream;
}

/**
 * Get direct downstream nodes (immediate children only)
 */
export function getDirectDownstream(nodeId: string, connections: Connection[]): Set<string> {
    return new Set(
        connections
            .filter(c => c.source === nodeId)
            .map(c => c.target)
    );
}

/**
 * Get direct upstream nodes (immediate parents only)
 */
export function getDirectUpstream(nodeId: string, connections: Connection[]): Set<string> {
    return new Set(
        connections
            .filter(c => c.target === nodeId)
            .map(c => c.source)
    );
}

/**
 * Calculate full blast radius for a node
 */
export function calculateBlastRadius(nodeId: string, connections: Connection[]): BlastRadiusResult {
    return {
        downstream: getDownstreamNodes(nodeId, connections),
        upstream: getUpstreamNodes(nodeId, connections),
        directDownstream: getDirectDownstream(nodeId, connections),
        directUpstream: getDirectUpstream(nodeId, connections),
    };
}

/**
 * Get connections that are part of the blast radius (for highlighting)
 */
export function getBlastRadiusConnections(
    nodeId: string,
    connections: Connection[],
    direction: 'downstream' | 'upstream' | 'both' = 'downstream'
): Set<string> {
    const affectedNodes = new Set<string>([nodeId]);

    if (direction === 'downstream' || direction === 'both') {
        const downstream = getDownstreamNodes(nodeId, connections);
        downstream.forEach(id => affectedNodes.add(id));
    }

    if (direction === 'upstream' || direction === 'both') {
        const upstream = getUpstreamNodes(nodeId, connections);
        upstream.forEach(id => affectedNodes.add(id));
    }

    return new Set(
        connections
            .filter(c => affectedNodes.has(c.source) && affectedNodes.has(c.target))
            .map(c => c.id)
    );
}
