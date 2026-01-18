/**
 * Complexity Score Calculator
 * Analyzes workflow complexity and suggests improvements
 */

import type { WorkflowNode, Connection } from '@nanoflow/shared';

export interface ComplexityResult {
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: ComplexityFactor[];
    suggestions: string[];
}

export interface ComplexityFactor {
    name: string;
    value: number;
    weight: number;
    contribution: number;
}

// Thresholds for complexity levels
const THRESHOLDS = {
    low: 15,
    medium: 30,
    high: 50,
};

/**
 * Calculate complexity score for a workflow
 */
export function calculateComplexityScore(
    nodes: WorkflowNode[],
    connections: Connection[]
): ComplexityResult {
    const factors: ComplexityFactor[] = [];
    const suggestions: string[] = [];

    // Filter out non-functional nodes (notes, frames)
    const functionalNodes = nodes.filter(n =>
        !n.type.startsWith('custom.note') && !n.type.startsWith('custom.frame')
    );

    // Factor 1: Node count (weight: 1.0)
    const nodeCount = functionalNodes.length;
    factors.push({
        name: 'Node Count',
        value: nodeCount,
        weight: 1.0,
        contribution: nodeCount * 1.0,
    });

    // Factor 2: Connection count (weight: 0.5)
    const connectionCount = connections.length;
    factors.push({
        name: 'Connections',
        value: connectionCount,
        weight: 0.5,
        contribution: connectionCount * 0.5,
    });

    // Factor 3: Branching complexity - nodes with multiple outputs (weight: 2.0)
    const branchingNodes = new Set<string>();
    const outputCounts: Record<string, number> = {};
    connections.forEach(c => {
        outputCounts[c.source] = (outputCounts[c.source] || 0) + 1;
    });
    Object.entries(outputCounts).forEach(([nodeId, count]) => {
        if (count > 1) branchingNodes.add(nodeId);
    });
    const branchingCount = branchingNodes.size;
    factors.push({
        name: 'Branching Nodes',
        value: branchingCount,
        weight: 2.0,
        contribution: branchingCount * 2.0,
    });

    // Factor 4: Merge complexity - nodes with multiple inputs (weight: 1.5)
    const inputCounts: Record<string, number> = {};
    connections.forEach(c => {
        inputCounts[c.target] = (inputCounts[c.target] || 0) + 1;
    });
    const mergeNodes = Object.values(inputCounts).filter(count => count > 1).length;
    factors.push({
        name: 'Merge Points',
        value: mergeNodes,
        weight: 1.5,
        contribution: mergeNodes * 1.5,
    });

    // Factor 5: Depth (longest path) - approximate via BFS (weight: 0.3)
    const depth = calculateMaxDepth(nodes, connections);
    factors.push({
        name: 'Max Depth',
        value: depth,
        weight: 0.3,
        contribution: depth * 0.3,
    });

    // Calculate total score
    const score = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0));

    // Determine level
    let level: ComplexityResult['level'] = 'low';
    if (score >= THRESHOLDS.high) level = 'critical';
    else if (score >= THRESHOLDS.medium) level = 'high';
    else if (score >= THRESHOLDS.low) level = 'medium';

    // Generate suggestions
    if (nodeCount > 20) {
        suggestions.push('Consider splitting into sub-workflows');
    }
    if (branchingCount > 5) {
        suggestions.push('High branching complexity - consider consolidating decision logic');
    }
    if (mergeNodes > 3) {
        suggestions.push('Multiple merge points detected - consider simplifying data flow');
    }
    if (depth > 10) {
        suggestions.push('Deep workflow chain - consider breaking into stages');
    }
    if (score >= THRESHOLDS.high && suggestions.length === 0) {
        suggestions.push('Workflow is complex - review for optimization opportunities');
    }

    return { score, level, factors, suggestions };
}

/**
 * Calculate maximum depth of the workflow graph
 */
function calculateMaxDepth(nodes: WorkflowNode[], connections: Connection[]): number {
    if (nodes.length === 0) return 0;

    // Build adjacency list
    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};

    nodes.forEach(n => {
        adj[n.id] = [];
        inDegree[n.id] = 0;
    });

    connections.forEach(c => {
        if (adj[c.source]) {
            adj[c.source].push(c.target);
        }
        if (inDegree[c.target] !== undefined) {
            inDegree[c.target]++;
        }
    });

    // Find starting nodes (no incoming connections)
    const startNodes = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
    if (startNodes.length === 0) return nodes.length; // Cycle detected, return node count

    // BFS to find max depth
    let maxDepth = 0;
    const queue: Array<{ nodeId: string; depth: number }> = startNodes.map(id => ({ nodeId: id, depth: 1 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
        const { nodeId, depth } = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        maxDepth = Math.max(maxDepth, depth);

        for (const next of adj[nodeId] || []) {
            if (!visited.has(next)) {
                queue.push({ nodeId: next, depth: depth + 1 });
            }
        }
    }

    return maxDepth;
}

/**
 * Get color for complexity level
 */
export function getComplexityColor(level: ComplexityResult['level']): string {
    switch (level) {
        case 'low': return '#10b981'; // green
        case 'medium': return '#f59e0b'; // yellow
        case 'high': return '#f97316'; // orange
        case 'critical': return '#ef4444'; // red
    }
}

/**
 * Get label for complexity level
 */
export function getComplexityLabel(level: ComplexityResult['level'], lang: 'en' | 'es'): string {
    const labels = {
        low: { en: 'Simple', es: 'Simple' },
        medium: { en: 'Moderate', es: 'Moderado' },
        high: { en: 'Complex', es: 'Complejo' },
        critical: { en: 'Very Complex', es: 'Muy Complejo' },
    };
    return labels[level][lang];
}
