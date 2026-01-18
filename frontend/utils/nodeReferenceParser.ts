/**
 * Node Reference Parser
 * Parses expressions in workflow nodes to detect data dependencies between nodes
 * This enables "Data Lineage" visualization without executing the workflow
 *
 * Based on n8n's node-reference-parser-utils.ts approach
 */

import type { WorkflowNode, Connection } from '@nanoflow/shared';

// =============================================================================
// Types
// =============================================================================

export interface NodeReference {
    sourceNodeId: string;      // The node containing the reference
    targetNodeName: string;    // The referenced node name
    targetNodeId?: string;     // Resolved node ID (if found)
    field: string;             // Field path where reference was found
    expression: string;        // The full expression containing the reference
    referenceType: ReferenceType;
}

export type ReferenceType =
    | 'function_call'      // $('NodeName')
    | 'bracket_notation'   // $node["NodeName"]
    | 'items_call'         // $items("NodeName")
    | 'template_variable'  // {{NodeName.output}}
    | 'input_reference'    // $input, $json (implicit previous node)
    | 'env_reference';     // $env.VAR (not a node reference, but tracked)

export interface DataLineageResult {
    references: NodeReference[];
    dataFlowMap: Map<string, Set<string>>;  // nodeId -> Set of nodeIds it depends on
    reverseFlowMap: Map<string, Set<string>>; // nodeId -> Set of nodeIds that depend on it
    unresolvedReferences: NodeReference[];   // References to nodes that don't exist
    implicitDependencies: Map<string, string[]>; // nodeId -> implicit dependencies (from $input, $json)
}

// =============================================================================
// Reference Patterns
// =============================================================================

const REFERENCE_PATTERNS: Array<{
    pattern: RegExp;
    type: ReferenceType;
    extractName: (match: RegExpMatchArray) => string | null;
}> = [
    // $('NodeName') or $("NodeName") - n8n function call style
    {
        pattern: /\$\(\s*['"]([^'"]+)['"]\s*\)/g,
        type: 'function_call',
        extractName: (match) => match[1],
    },
    // $node["NodeName"] or $node['NodeName'] - n8n bracket notation
    {
        pattern: /\$node\s*\[\s*['"]([^'"]+)['"]\s*\]/g,
        type: 'bracket_notation',
        extractName: (match) => match[1],
    },
    // $items("NodeName") or $items('NodeName') - n8n items function
    {
        pattern: /\$items\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        type: 'items_call',
        extractName: (match) => match[1],
    },
    // {{NodeName.field}} or {{ NodeName.field }} - template variable style
    {
        pattern: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*\w+/g,
        type: 'template_variable',
        extractName: (match) => match[1],
    },
    // $input - references the previous node (implicit)
    {
        pattern: /\$input(?:\s*\.|(?:\s*\[))/g,
        type: 'input_reference',
        extractName: () => '$input',
    },
    // $json - references the previous node's JSON output (implicit)
    {
        pattern: /\$json(?:\s*\.|(?:\s*\[))/g,
        type: 'input_reference',
        extractName: () => '$json',
    },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract all string values from a nested object
 */
function extractStringValues(
    obj: Record<string, any>,
    path: string = ''
): Array<{ value: string; path: string }> {
    const results: Array<{ value: string; path: string }> = [];

    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === 'string') {
            results.push({ value, path: currentPath });
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            results.push(...extractStringValues(value, currentPath));
        } else if (Array.isArray(value)) {
            value.forEach((item, index) => {
                if (typeof item === 'string') {
                    results.push({ value: item, path: `${currentPath}[${index}]` });
                } else if (typeof item === 'object' && item !== null) {
                    results.push(...extractStringValues(item, `${currentPath}[${index}]`));
                }
            });
        }
    }

    return results;
}

/**
 * Find references in a single string value
 */
function findReferencesInString(
    value: string,
    sourceNodeId: string,
    field: string
): NodeReference[] {
    const references: NodeReference[] = [];

    for (const { pattern, type, extractName } of REFERENCE_PATTERNS) {
        // Reset regex state for global patterns
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(value)) !== null) {
            const nodeName = extractName(match);
            if (nodeName) {
                references.push({
                    sourceNodeId,
                    targetNodeName: nodeName,
                    field,
                    expression: match[0],
                    referenceType: type,
                });
            }
        }
    }

    return references;
}

/**
 * Create a map of node names to node IDs
 */
function createNodeNameMap(nodes: WorkflowNode[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const node of nodes) {
        map.set(node.title, node.id);
        // Also map by ID for self-references
        map.set(node.id, node.id);
    }
    return map;
}

/**
 * Get the previous node(s) based on connections
 */
function getPreviousNodes(nodeId: string, connections: Connection[]): string[] {
    return connections
        .filter(c => c.target === nodeId)
        .map(c => c.source);
}

// =============================================================================
// Main Parser Functions
// =============================================================================

/**
 * Parse all node references in a workflow
 */
export function parseNodeReferences(
    nodes: WorkflowNode[],
    connections: Connection[]
): DataLineageResult {
    const references: NodeReference[] = [];
    const unresolvedReferences: NodeReference[] = [];
    const nodeNameMap = createNodeNameMap(nodes);
    const implicitDependencies = new Map<string, string[]>();

    // Parse each node
    for (const node of nodes) {
        // Skip organizational nodes
        if (node.type.startsWith('custom.note') || node.type.startsWith('custom.frame')) {
            continue;
        }

        // Extract all string values from config
        if (node.config && typeof node.config === 'object') {
            const stringValues = extractStringValues(node.config as Record<string, any>);

            for (const { value, path } of stringValues) {
                const nodeRefs = findReferencesInString(value, node.id, `config.${path}`);

                for (const ref of nodeRefs) {
                    // Handle implicit references ($input, $json)
                    if (ref.referenceType === 'input_reference') {
                        const previousNodes = getPreviousNodes(node.id, connections);
                        if (previousNodes.length > 0) {
                            implicitDependencies.set(node.id, previousNodes);
                            // Create resolved references for each previous node
                            for (const prevId of previousNodes) {
                                references.push({
                                    ...ref,
                                    targetNodeId: prevId,
                                    targetNodeName: nodes.find(n => n.id === prevId)?.title || prevId,
                                });
                            }
                        }
                    } else {
                        // Try to resolve the node name to an ID
                        const targetId = nodeNameMap.get(ref.targetNodeName);
                        if (targetId) {
                            references.push({
                                ...ref,
                                targetNodeId: targetId,
                            });
                        } else {
                            unresolvedReferences.push(ref);
                        }
                    }
                }
            }
        }
    }

    // Build flow maps
    const dataFlowMap = new Map<string, Set<string>>();
    const reverseFlowMap = new Map<string, Set<string>>();

    // Initialize maps with all nodes
    for (const node of nodes) {
        dataFlowMap.set(node.id, new Set());
        reverseFlowMap.set(node.id, new Set());
    }

    // Populate from references
    references.forEach(ref => {
        if (ref.targetNodeId) {
            // This node depends on the target
            dataFlowMap.get(ref.sourceNodeId)?.add(ref.targetNodeId);
            // The target is depended on by this node
            reverseFlowMap.get(ref.targetNodeId)?.add(ref.sourceNodeId);
        }
    });

    return {
        references,
        dataFlowMap,
        reverseFlowMap,
        unresolvedReferences,
        implicitDependencies,
    };
}

/**
 * Get all data dependencies for a specific node (what nodes does it read from)
 */
export function getDataDependencies(
    nodeId: string,
    nodes: WorkflowNode[],
    connections: Connection[]
): Set<string> {
    const result = parseNodeReferences(nodes, connections);
    return result.dataFlowMap.get(nodeId) || new Set();
}

/**
 * Get all data dependents for a specific node (what nodes read from it)
 */
export function getDataDependents(
    nodeId: string,
    nodes: WorkflowNode[],
    connections: Connection[]
): Set<string> {
    const result = parseNodeReferences(nodes, connections);
    return result.reverseFlowMap.get(nodeId) || new Set();
}

/**
 * Merge explicit connections with implicit data references
 * This gives a complete picture of data flow
 */
export function getCompleteDataLineage(
    nodes: WorkflowNode[],
    connections: Connection[]
): {
    explicit: Map<string, Set<string>>;  // From connections
    implicit: Map<string, Set<string>>;  // From expressions
    combined: Map<string, Set<string>>;  // Both merged
} {
    const explicit = new Map<string, Set<string>>();
    const combined = new Map<string, Set<string>>();

    // Initialize
    for (const node of nodes) {
        explicit.set(node.id, new Set());
        combined.set(node.id, new Set());
    }

    // Build explicit from connections
    for (const conn of connections) {
        explicit.get(conn.target)?.add(conn.source);
        combined.get(conn.target)?.add(conn.source);
    }

    // Get implicit from references
    const { dataFlowMap: implicit } = parseNodeReferences(nodes, connections);

    // Merge implicit into combined
    Array.from(implicit.entries()).forEach(([nodeId, deps]) => {
        Array.from(deps).forEach(dep => {
            combined.get(nodeId)?.add(dep);
        });
    });

    return { explicit, implicit, combined };
}

/**
 * Detect circular data dependencies
 */
export function detectCircularDependencies(
    nodes: WorkflowNode[],
    connections: Connection[]
): string[][] {
    const { combined } = getCompleteDataLineage(nodes, connections);
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function dfs(nodeId: string, path: string[]): boolean {
        visited.add(nodeId);
        recursionStack.add(nodeId);

        const dependencies = combined.get(nodeId) || new Set<string>();
        const depsArray = Array.from(dependencies);

        for (let i = 0; i < depsArray.length; i++) {
            const dep = depsArray[i];
            if (!visited.has(dep)) {
                if (dfs(dep, [...path, dep])) {
                    return true;
                }
            } else if (recursionStack.has(dep)) {
                // Found a cycle
                const cycleStart = path.indexOf(dep);
                if (cycleStart !== -1) {
                    cycles.push(path.slice(cycleStart));
                } else {
                    cycles.push([...path, dep]);
                }
                return true;
            }
        }

        recursionStack.delete(nodeId);
        return false;
    }

    for (const node of nodes) {
        if (!visited.has(node.id)) {
            dfs(node.id, [node.id]);
        }
    }

    return cycles;
}

/**
 * Get summary statistics about data lineage
 */
export function getLineageSummary(
    nodes: WorkflowNode[],
    connections: Connection[]
): {
    totalReferences: number;
    unresolvedCount: number;
    nodesWithReferences: number;
    mostReferencedNode: { id: string; title: string; count: number } | null;
    hasCircularDeps: boolean;
} {
    const result = parseNodeReferences(nodes, connections);
    const cycles = detectCircularDependencies(nodes, connections);

    // Count references per target node
    const referenceCounts = new Map<string, number>();
    for (const ref of result.references) {
        if (ref.targetNodeId) {
            referenceCounts.set(
                ref.targetNodeId,
                (referenceCounts.get(ref.targetNodeId) || 0) + 1
            );
        }
    }

    // Find most referenced
    let mostReferencedNode: { id: string; title: string; count: number } | null = null;
    let maxCount = 0;
    Array.from(referenceCounts.entries()).forEach(([nodeId, count]) => {
        if (count > maxCount) {
            maxCount = count;
            const node = nodes.find(n => n.id === nodeId);
            mostReferencedNode = {
                id: nodeId,
                title: node?.title || nodeId,
                count,
            };
        }
    });

    // Count nodes that have references
    const nodesWithRefs = new Set(result.references.map(r => r.sourceNodeId));

    return {
        totalReferences: result.references.length,
        unresolvedCount: result.unresolvedReferences.length,
        nodesWithReferences: nodesWithRefs.size,
        mostReferencedNode,
        hasCircularDeps: cycles.length > 0,
    };
}
