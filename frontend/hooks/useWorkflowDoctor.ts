/**
 * useWorkflowDoctor - Workflow linter/validator hook
 * Detects common issues in workflows:
 * - Disconnected nodes
 * - Cycles in the workflow
 * - Missing required connections
 * - Potential secrets in node configurations
 * - Empty workflows
 * - Duplicate node IDs
 */

import { useMemo } from 'react';
import { WorkflowNode, Connection } from '@nanoflow/shared';

// Issue severity levels
export type IssueSeverity = 'error' | 'warning' | 'info';

// Issue categories
export type IssueCategory =
    | 'connection'
    | 'security'
    | 'structure'
    | 'performance'
    | 'best-practice';

// Workflow issue interface
export interface WorkflowIssue {
    id: string;
    severity: IssueSeverity;
    category: IssueCategory;
    message: string;
    description: string;
    nodeId?: string;
    connectionId?: string;
    suggestion?: string;
}

// Secret patterns to detect
const SECRET_PATTERNS = [
    { pattern: /api[_-]?key/i, name: 'API Key' },
    { pattern: /secret[_-]?key/i, name: 'Secret Key' },
    { pattern: /password/i, name: 'Password' },
    { pattern: /token/i, name: 'Token' },
    { pattern: /bearer/i, name: 'Bearer Token' },
    { pattern: /auth[_-]?key/i, name: 'Auth Key' },
    { pattern: /private[_-]?key/i, name: 'Private Key' },
    { pattern: /credential/i, name: 'Credential' },
    { pattern: /access[_-]?key/i, name: 'Access Key' },
    { pattern: /client[_-]?secret/i, name: 'Client Secret' },
];

// Patterns that look like actual secrets (not just field names)
const SECRET_VALUE_PATTERNS = [
    /^sk-[a-zA-Z0-9]{20,}$/, // OpenAI style
    /^pk_[a-zA-Z0-9]{20,}$/, // Stripe public key style
    /^sk_[a-zA-Z0-9]{20,}$/, // Stripe secret key style
    /^ghp_[a-zA-Z0-9]{36}$/, // GitHub personal access token
    /^gho_[a-zA-Z0-9]{36}$/, // GitHub OAuth token
    /^xox[baprs]-[a-zA-Z0-9-]+$/, // Slack token
    /^AKIA[0-9A-Z]{16}$/, // AWS access key
    /^[a-f0-9]{32}$/, // Generic 32-char hex (MD5-like)
    /^[a-f0-9]{40}$/, // Generic 40-char hex (SHA1-like)
    /^[a-f0-9]{64}$/, // Generic 64-char hex (SHA256-like)
    /^eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*$/, // JWT token
];

interface UseWorkflowDoctorOptions {
    nodes: WorkflowNode[];
    connections: Connection[];
    enabled?: boolean;
}

interface UseWorkflowDoctorResult {
    issues: WorkflowIssue[];
    errorCount: number;
    warningCount: number;
    infoCount: number;
    hasErrors: boolean;
    hasWarnings: boolean;
    isHealthy: boolean;
}

/**
 * Detect cycles in the workflow using DFS
 */
function detectCycles(
    nodes: WorkflowNode[],
    connections: Connection[]
): { hasCycle: boolean; cycleNodes: string[] } {
    const nodeIds = new Set(nodes.map(n => n.id));
    const adjacencyList = new Map<string, string[]>();

    // Build adjacency list
    for (const nodeId of nodeIds) {
        adjacencyList.set(nodeId, []);
    }

    for (const conn of connections) {
        const targets = adjacencyList.get(conn.source) || [];
        targets.push(conn.target);
        adjacencyList.set(conn.source, targets);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycleNodes: string[] = [];

    function dfs(nodeId: string, path: string[]): boolean {
        visited.add(nodeId);
        recursionStack.add(nodeId);

        const neighbors = adjacencyList.get(nodeId) || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                if (dfs(neighbor, [...path, nodeId])) {
                    return true;
                }
            } else if (recursionStack.has(neighbor)) {
                // Found a cycle
                cycleNodes.push(...path, nodeId, neighbor);
                return true;
            }
        }

        recursionStack.delete(nodeId);
        return false;
    }

    for (const nodeId of nodeIds) {
        if (!visited.has(nodeId)) {
            if (dfs(nodeId, [])) {
                return { hasCycle: true, cycleNodes: [...new Set(cycleNodes)] };
            }
        }
    }

    return { hasCycle: false, cycleNodes: [] };
}

/**
 * Find disconnected nodes (nodes with no connections)
 */
function findDisconnectedNodes(
    nodes: WorkflowNode[],
    connections: Connection[]
): string[] {
    const connectedNodes = new Set<string>();

    for (const conn of connections) {
        connectedNodes.add(conn.source);
        connectedNodes.add(conn.target);
    }

    return nodes
        .filter(node => !connectedNodes.has(node.id))
        .filter(node => {
            // Exclude notes and frames from disconnected check
            const type = node.type.toLowerCase();
            return !type.includes('note') && !type.includes('frame');
        })
        .map(node => node.id);
}

/**
 * Detect potential secrets in node configurations
 */
function detectSecrets(
    nodes: WorkflowNode[]
): Array<{ nodeId: string; field: string; secretType: string }> {
    const secrets: Array<{ nodeId: string; field: string; secretType: string }> = [];

    for (const node of nodes) {
        const config = (node as any).config || (node as any).data || {};

        // Check each field in the config
        for (const [key, value] of Object.entries(config)) {
            if (typeof value !== 'string') continue;

            // Check if field name suggests it's a secret
            for (const { pattern, name } of SECRET_PATTERNS) {
                if (pattern.test(key)) {
                    // Check if the value looks like an actual secret (not a placeholder)
                    if (value.length > 8 && !value.startsWith('{{') && !value.startsWith('${')) {
                        secrets.push({ nodeId: node.id, field: key, secretType: name });
                        break;
                    }
                }
            }

            // Check if value matches known secret patterns
            for (const pattern of SECRET_VALUE_PATTERNS) {
                if (pattern.test(value)) {
                    secrets.push({ nodeId: node.id, field: key, secretType: 'Hardcoded Secret' });
                    break;
                }
            }
        }
    }

    return secrets;
}

/**
 * Find duplicate node IDs
 */
function findDuplicateIds(nodes: WorkflowNode[]): string[] {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const node of nodes) {
        if (seen.has(node.id)) {
            duplicates.push(node.id);
        } else {
            seen.add(node.id);
        }
    }

    return duplicates;
}

/**
 * Find nodes without required outputs (triggers with no connections)
 */
function findTriggersWithoutOutputs(
    nodes: WorkflowNode[],
    connections: Connection[]
): string[] {
    const nodesWithOutputs = new Set(connections.map(c => c.source));

    return nodes
        .filter(node => {
            const type = node.type.toLowerCase();
            return type.includes('trigger') || type === 'start';
        })
        .filter(node => !nodesWithOutputs.has(node.id))
        .map(node => node.id);
}

/**
 * Find nodes without required inputs (non-triggers with no incoming connections)
 */
function findNodesWithoutInputs(
    nodes: WorkflowNode[],
    connections: Connection[]
): string[] {
    const nodesWithInputs = new Set(connections.map(c => c.target));

    return nodes
        .filter(node => {
            const type = node.type.toLowerCase();
            // Triggers and start nodes don't need inputs
            if (type.includes('trigger') || type === 'start') return false;
            // Notes and frames don't need inputs
            if (type.includes('note') || type.includes('frame')) return false;
            return true;
        })
        .filter(node => !nodesWithInputs.has(node.id))
        .map(node => node.id);
}

/**
 * Main hook for workflow validation
 */
export function useWorkflowDoctor({
    nodes,
    connections,
    enabled = true,
}: UseWorkflowDoctorOptions): UseWorkflowDoctorResult {
    const issues = useMemo(() => {
        if (!enabled) return [];

        const foundIssues: WorkflowIssue[] = [];
        let issueId = 0;

        // 1. Check for empty workflow
        if (nodes.length === 0) {
            foundIssues.push({
                id: `issue-${issueId++}`,
                severity: 'info',
                category: 'structure',
                message: 'Empty workflow',
                description: 'This workflow has no nodes. Add nodes to build your automation.',
                suggestion: 'Start by adding a trigger node to begin your workflow.',
            });
            return foundIssues;
        }

        // 2. Check for duplicate IDs
        const duplicateIds = findDuplicateIds(nodes);
        for (const id of duplicateIds) {
            foundIssues.push({
                id: `issue-${issueId++}`,
                severity: 'error',
                category: 'structure',
                message: 'Duplicate node ID',
                description: `Multiple nodes have the same ID: ${id}`,
                nodeId: id,
                suggestion: 'This is a bug. Try refreshing the page or recreating the node.',
            });
        }

        // 3. Check for cycles
        const { hasCycle, cycleNodes } = detectCycles(nodes, connections);
        if (hasCycle) {
            foundIssues.push({
                id: `issue-${issueId++}`,
                severity: 'warning',
                category: 'structure',
                message: 'Cycle detected',
                description: `The workflow contains a cycle involving ${cycleNodes.length} nodes. This may cause infinite loops during execution.`,
                suggestion: 'Consider breaking the cycle by removing one of the connections.',
            });
        }

        // 4. Check for disconnected nodes
        const disconnectedNodes = findDisconnectedNodes(nodes, connections);
        for (const nodeId of disconnectedNodes) {
            const node = nodes.find(n => n.id === nodeId);
            foundIssues.push({
                id: `issue-${issueId++}`,
                severity: 'warning',
                category: 'connection',
                message: 'Disconnected node',
                description: `Node "${node?.title || nodeId}" is not connected to any other node.`,
                nodeId,
                suggestion: 'Connect this node to the workflow or remove it if not needed.',
            });
        }

        // 5. Check for triggers without outputs
        const triggersWithoutOutputs = findTriggersWithoutOutputs(nodes, connections);
        for (const nodeId of triggersWithoutOutputs) {
            const node = nodes.find(n => n.id === nodeId);
            foundIssues.push({
                id: `issue-${issueId++}`,
                severity: 'warning',
                category: 'connection',
                message: 'Trigger without output',
                description: `Trigger "${node?.title || nodeId}" has no output connections. It won't start any workflow.`,
                nodeId,
                suggestion: 'Connect this trigger to another node to define what happens when it fires.',
            });
        }

        // 6. Check for nodes without inputs (non-triggers)
        const nodesWithoutInputs = findNodesWithoutInputs(nodes, connections);
        for (const nodeId of nodesWithoutInputs) {
            const node = nodes.find(n => n.id === nodeId);
            foundIssues.push({
                id: `issue-${issueId++}`,
                severity: 'info',
                category: 'connection',
                message: 'Node without input',
                description: `Node "${node?.title || nodeId}" has no input connections. It won't be executed automatically.`,
                nodeId,
                suggestion: 'Connect this node to a trigger or another node in the workflow.',
            });
        }

        // 7. Check for potential secrets
        const secrets = detectSecrets(nodes);
        for (const { nodeId, field, secretType } of secrets) {
            const node = nodes.find(n => n.id === nodeId);
            foundIssues.push({
                id: `issue-${issueId++}`,
                severity: 'warning',
                category: 'security',
                message: 'Potential secret detected',
                description: `Node "${node?.title || nodeId}" may contain a hardcoded ${secretType} in field "${field}".`,
                nodeId,
                suggestion: 'Use environment variables or a secrets manager instead of hardcoding sensitive values.',
            });
        }

        // 8. Check for no triggers (workflow can't be started)
        const hasTrigger = nodes.some(node => {
            const type = node.type.toLowerCase();
            return type.includes('trigger') || type === 'start';
        });

        if (!hasTrigger && nodes.length > 0) {
            foundIssues.push({
                id: `issue-${issueId++}`,
                severity: 'info',
                category: 'structure',
                message: 'No trigger node',
                description: 'This workflow has no trigger. It can only be run manually.',
                suggestion: 'Add a trigger node (like Schedule, Webhook, or Manual trigger) to automate execution.',
            });
        }

        return foundIssues;
    }, [nodes, connections, enabled]);

    const counts = useMemo(() => {
        let errors = 0;
        let warnings = 0;
        let infos = 0;

        for (const issue of issues) {
            switch (issue.severity) {
                case 'error': errors++; break;
                case 'warning': warnings++; break;
                case 'info': infos++; break;
            }
        }

        return {
            errorCount: errors,
            warningCount: warnings,
            infoCount: infos,
            hasErrors: errors > 0,
            hasWarnings: warnings > 0,
            isHealthy: errors === 0 && warnings === 0,
        };
    }, [issues]);

    return {
        issues,
        ...counts,
    };
}

export default useWorkflowDoctor;