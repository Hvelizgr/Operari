/**
 * Architecture Linter
 * Validates workflow best practices and common issues
 */

import type { WorkflowNode, Connection } from '@nanoflow/shared';

export interface LintIssue {
    id: string;
    nodeId?: string;
    nodeTitle?: string;
    rule: LintRule;
    severity: 'info' | 'warning' | 'error';
    message: string;
    suggestion?: string;
}

export type LintRule =
    | 'no-trigger'
    | 'orphan-node'
    | 'dead-end'
    | 'unreachable-node'
    | 'circular-dependency'
    | 'multiple-triggers'
    | 'empty-workflow'
    | 'disconnected-trigger'
    | 'missing-error-handler';

export interface LintResult {
    issues: LintIssue[];
    passed: boolean;
    errorCount: number;
    warningCount: number;
    infoCount: number;
}

/**
 * Run all linting rules on a workflow
 */
export function lintWorkflow(nodes: WorkflowNode[], connections: Connection[]): LintResult {
    const issues: LintIssue[] = [];

    // Filter functional nodes
    const functionalNodes = nodes.filter(n =>
        !n.type.startsWith('custom.note') && !n.type.startsWith('custom.frame')
    );

    // Run each rule
    issues.push(...checkEmptyWorkflow(functionalNodes));
    issues.push(...checkNoTrigger(functionalNodes));
    issues.push(...checkMultipleTriggers(functionalNodes));
    issues.push(...checkOrphanNodes(functionalNodes, connections));
    issues.push(...checkDeadEndNodes(functionalNodes, connections));
    issues.push(...checkUnreachableNodes(functionalNodes, connections));
    issues.push(...checkDisconnectedTrigger(functionalNodes, connections));

    // Count by severity
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    return {
        issues,
        passed: errorCount === 0,
        errorCount,
        warningCount,
        infoCount,
    };
}

/**
 * Check if workflow is empty
 */
function checkEmptyWorkflow(nodes: WorkflowNode[]): LintIssue[] {
    if (nodes.length === 0) {
        return [{
            id: 'empty-workflow-1',
            rule: 'empty-workflow',
            severity: 'info',
            message: 'Workflow is empty',
            suggestion: 'Add a trigger node to start building your workflow',
        }];
    }
    return [];
}

/**
 * Check if workflow has at least one trigger
 */
function checkNoTrigger(nodes: WorkflowNode[]): LintIssue[] {
    const triggers = nodes.filter(n => isTriggerNode(n));

    if (nodes.length > 0 && triggers.length === 0) {
        return [{
            id: 'no-trigger-1',
            rule: 'no-trigger',
            severity: 'warning',
            message: 'Workflow has no trigger node',
            suggestion: 'Add a trigger (Webhook, Schedule, Manual) to start the workflow',
        }];
    }
    return [];
}

/**
 * Check for multiple triggers (usually a design issue)
 */
function checkMultipleTriggers(nodes: WorkflowNode[]): LintIssue[] {
    const triggers = nodes.filter(n => isTriggerNode(n));

    if (triggers.length > 1) {
        return [{
            id: 'multiple-triggers-1',
            rule: 'multiple-triggers',
            severity: 'info',
            message: `Workflow has ${triggers.length} trigger nodes`,
            suggestion: 'Consider splitting into separate workflows for clarity',
        }];
    }
    return [];
}

/**
 * Check for orphan nodes (no connections at all)
 */
function checkOrphanNodes(nodes: WorkflowNode[], connections: Connection[]): LintIssue[] {
    const issues: LintIssue[] = [];
    const connectedNodes = new Set<string>();

    connections.forEach(c => {
        connectedNodes.add(c.source);
        connectedNodes.add(c.target);
    });

    for (const node of nodes) {
        // Triggers don't need incoming connections
        if (isTriggerNode(node)) continue;

        if (!connectedNodes.has(node.id)) {
            issues.push({
                id: `orphan-${node.id}`,
                nodeId: node.id,
                nodeTitle: node.title,
                rule: 'orphan-node',
                severity: 'warning',
                message: `"${node.title}" is not connected to any other node`,
                suggestion: 'Connect this node or remove it if unused',
            });
        }
    }

    return issues;
}

/**
 * Check for dead-end nodes (nodes that should have outputs but don't)
 */
function checkDeadEndNodes(nodes: WorkflowNode[], connections: Connection[]): LintIssue[] {
    const issues: LintIssue[] = [];
    const nodesWithOutputs = new Set(connections.map(c => c.source));

    for (const node of nodes) {
        // Skip nodes that are typically endpoints
        if (isEndpointNode(node)) continue;
        // Skip if it has outgoing connections
        if (nodesWithOutputs.has(node.id)) continue;
        // Skip orphan nodes (already reported)
        const hasIncoming = connections.some(c => c.target === node.id);
        if (!hasIncoming && !isTriggerNode(node)) continue;

        // This node has incoming but no outgoing - potential dead end
        if (hasIncoming || isTriggerNode(node)) {
            issues.push({
                id: `dead-end-${node.id}`,
                nodeId: node.id,
                nodeTitle: node.title,
                rule: 'dead-end',
                severity: 'info',
                message: `"${node.title}" has no outgoing connections`,
                suggestion: 'This may be intentional, or you may want to add more nodes',
            });
        }
    }

    return issues;
}

/**
 * Check for unreachable nodes (not connected to any trigger)
 */
function checkUnreachableNodes(nodes: WorkflowNode[], connections: Connection[]): LintIssue[] {
    const issues: LintIssue[] = [];

    // Find all trigger nodes
    const triggers = nodes.filter(n => isTriggerNode(n));
    if (triggers.length === 0) return [];

    // BFS from all triggers to find reachable nodes
    const reachable = new Set<string>();
    const queue = triggers.map(t => t.id);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (reachable.has(current)) continue;
        reachable.add(current);

        // Find all nodes connected from current
        connections
            .filter(c => c.source === current)
            .forEach(c => {
                if (!reachable.has(c.target)) {
                    queue.push(c.target);
                }
            });
    }

    // Check which nodes are not reachable
    for (const node of nodes) {
        if (isTriggerNode(node)) continue;
        if (reachable.has(node.id)) continue;

        // Check if it has any connections (not completely orphan)
        const hasConnections = connections.some(c => c.source === node.id || c.target === node.id);
        if (!hasConnections) continue; // Already reported as orphan

        issues.push({
            id: `unreachable-${node.id}`,
            nodeId: node.id,
            nodeTitle: node.title,
            rule: 'unreachable-node',
            severity: 'warning',
            message: `"${node.title}" is not reachable from any trigger`,
            suggestion: 'Connect this node to the main workflow flow',
        });
    }

    return issues;
}

/**
 * Check for triggers that don't connect to anything
 */
function checkDisconnectedTrigger(nodes: WorkflowNode[], connections: Connection[]): LintIssue[] {
    const issues: LintIssue[] = [];
    const triggers = nodes.filter(n => isTriggerNode(n));

    for (const trigger of triggers) {
        const hasOutput = connections.some(c => c.source === trigger.id);
        if (!hasOutput) {
            issues.push({
                id: `disconnected-trigger-${trigger.id}`,
                nodeId: trigger.id,
                nodeTitle: trigger.title,
                rule: 'disconnected-trigger',
                severity: 'warning',
                message: `Trigger "${trigger.title}" is not connected to any node`,
                suggestion: 'Connect the trigger to start building your workflow',
            });
        }
    }

    return issues;
}

/**
 * Helper: Check if a node is a trigger type
 */
function isTriggerNode(node: WorkflowNode): boolean {
    const type = node.type.toLowerCase();
    return (
        type.includes('trigger') ||
        type.includes('webhook') ||
        type.includes('schedule') ||
        type.includes('cron') ||
        type === 'manual' ||
        type === 'start'
    );
}

/**
 * Helper: Check if a node is typically an endpoint (no output expected)
 */
function isEndpointNode(node: WorkflowNode): boolean {
    const type = node.type.toLowerCase();
    return (
        type.includes('email') ||
        type.includes('slack') ||
        type.includes('notification') ||
        type.includes('log') ||
        type.includes('response')
    );
}

/**
 * Get icon for severity
 */
export function getSeverityIcon(severity: LintIssue['severity']): string {
    switch (severity) {
        case 'error': return '❌';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
    }
}

/**
 * Get color for severity
 */
export function getSeverityColor(severity: LintIssue['severity']): string {
    switch (severity) {
        case 'error': return '#ef4444';
        case 'warning': return '#f59e0b';
        case 'info': return '#3b82f6';
    }
}
