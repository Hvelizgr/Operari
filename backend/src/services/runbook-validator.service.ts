import { WorkflowConnection, WorkflowDefinition, WorkflowNode } from '../types/runbook.types';

export enum ValidationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  nodeId?: string;
  field?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationOptions {
  /** Approval steps a privileged ssh step needs upstream (workspace policy). */
  privilegedApprovals?: number;
}

export class RunbookValidatorService {
  /**
   * Validate a runbook definition
   */
  public validate(runbook: WorkflowDefinition, options: ValidationOptions = {}): ValidationResult {
    const issues: ValidationIssue[] = [];

    // 1. Basic empty check
    if (!runbook.nodes || runbook.nodes.length === 0) {
      return {
        isValid: true, // Allow saving empty workflows, but warn
        issues: [{ severity: ValidationSeverity.WARNING, message: 'Workflow is empty' }],
      };
    }

    // 2. Trigger check
    this.checkTriggers(runbook.nodes, issues);

    // 3. Orphan check
    this.checkOrphans(runbook.nodes, runbook.connections, issues);

    // 4. Configuration check
    this.checkConfigurations(runbook.nodes, issues);

    // 5. Connection validity
    this.checkConnections(runbook.nodes, runbook.connections, issues);

    // 6. Cycle detection. The engine uses a greedy re-queue loop to
    // satisfy multi-parent joins; a runbook with a real cycle (A→B→C→A)
    // would re-queue forever and burn a worker. Catch it at save time
    // so the cycle never reaches the runtime.
    this.checkCycles(runbook.nodes, runbook.connections, issues);

    // 7. A privileged ssh step (`sudo -n`) must sit behind enough approval
    // steps that every path to it crosses them. Re-checked at run time
    // against real approvers, so this is the early, visible half.
    this.checkPrivileged(
      runbook.nodes,
      runbook.connections,
      options.privilegedApprovals ?? 1,
      issues
    );

    // Determine validity based on errors
    const hasErrors = issues.some(i => i.severity === ValidationSeverity.ERROR);

    return {
      isValid: !hasErrors,
      issues,
    };
  }

  /**
   * Ensure there is at least one trigger node
   */
  private checkTriggers(nodes: WorkflowNode[], issues: ValidationIssue[]): void {
    const triggerTypes = ['Trigger', 'Webhook', 'Schedule', 'operari.webhook', 'operari.cron'];
    const hasTrigger = nodes.some(node => triggerTypes.includes(node.type));

    if (!hasTrigger) {
      issues.push({
        severity: ValidationSeverity.WARNING,
        message: 'Workflow has no trigger node. It can only be executed manually.',
      });
    }
  }

  /**
   * Check for nodes with no connections (orphans)
   */
  private checkOrphans(
    nodes: WorkflowNode[],
    connections: WorkflowConnection[],
    issues: ValidationIssue[]
  ): void {
    const connectedNodeIds = new Set<string>();

    connections.forEach(conn => {
      connectedNodeIds.add(conn.source);
      connectedNodeIds.add(conn.target);
    });

    nodes.forEach(node => {
      // Ignore if it's the only node, or if it's a comment/note node (if we had those)
      if (!connectedNodeIds.has(node.id) && nodes.length > 1) {
        issues.push({
          severity: ValidationSeverity.WARNING,
          message: `Node "${node.title || node.id}" is not connected to any other node.`,
          nodeId: node.id,
        });
      }
    });
  }

  /**
   * Validate required configurations for specific node types
   */
  private checkConfigurations(nodes: WorkflowNode[], issues: ValidationIssue[]): void {
    nodes.forEach(node => {
      // Cast to `Record<string, unknown>` rather than `any` so field
      // access stays type-checked downstream. The switch below uses
      // simple truthiness on individual keys (`!config.url`), which
      // works on `unknown` without further narrowing.
      const config = (node.config ?? {}) as Record<string, unknown>;

      switch (node.type) {
        case 'HTTP':
          if (!config.url) {
            issues.push({
              severity: ValidationSeverity.ERROR,
              message: 'HTTP node requires a URL.',
              nodeId: node.id,
              field: 'url',
            });
          }
          break;
        case 'Condition':
          // Just example validation, flexible types might use different fields
          if (Object.keys(config).length === 0) {
            // Some condition nodes might be valid without strict config if defaults apply
            // but usually they need at least a condition or field
          }
          break;
        case 'Email':
          if (!config.to) {
            issues.push({
              severity: ValidationSeverity.ERROR,
              message: 'Email node requires a recipient (To).',
              nodeId: node.id,
              field: 'to',
            });
          }
          break;
        case 'Schedule':
          // Example: check if cron expression or interval is set
          if (!config.cron && !config.interval) {
            // often schedule is on the runbook level, but if it's a node...
          }
          break;
      }
    });
  }

  /**
   * Check connection integrity (source and target exist, no self-loops)
   */
  private checkConnections(
    nodes: WorkflowNode[],
    connections: WorkflowConnection[],
    issues: ValidationIssue[]
  ): void {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    connections.forEach(conn => {
      const source = nodeMap.get(conn.source);
      const target = nodeMap.get(conn.target);

      if (!source) {
        issues.push({
          severity: ValidationSeverity.ERROR,
          message: `Connection references missing source node ${conn.source}`,
        });
      }
      if (!target) {
        issues.push({
          severity: ValidationSeverity.ERROR,
          message: `Connection references missing target node ${conn.target}`,
        });
      }

      if (conn.source === conn.target) {
        issues.push({
          severity: ValidationSeverity.WARNING,
          message: `Self-referencing connection detected on node ${conn.source}`,
          nodeId: conn.source,
        });
      }
    });
  }

  /**
   * Detect cycles in the DAG via three-color DFS.
   *
   * - WHITE  (0) : not yet visited
   * - GRAY   (1) : on the current DFS path
   * - BLACK  (2) : fully explored; no cycle reachable through this node
   *
   * Encountering a GRAY neighbor means we looped back to an ancestor —
   * that's a cycle. We extract the stack slice from the ancestor to the
   * current node to report the full chain so the user can click straight
   * to the offending edge.
   *
   * Self-loops and connections to unknown nodes are handled elsewhere
   * (checkConnections); this pass filters them out so the cycle reporter
   * doesn't double-report.
   */
  private checkCycles(
    nodes: WorkflowNode[],
    connections: WorkflowConnection[],
    issues: ValidationIssue[]
  ): void {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n.id, []);
    for (const c of connections) {
      if (c.source === c.target) continue;
      if (!adj.has(c.source) || !adj.has(c.target)) continue;
      adj.get(c.source)!.push(c.target);
    }

    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    for (const n of nodes) color.set(n.id, WHITE);

    /** Canonical key for a cycle so we don't report the same loop twice
     *  from two entry points (A→B→C→A and B→C→A→B are the same cycle). */
    const reported = new Set<string>();

    const dfs = (nodeId: string, stack: string[]): void => {
      color.set(nodeId, GRAY);
      stack.push(nodeId);
      for (const next of adj.get(nodeId) ?? []) {
        const c = color.get(next);
        if (c === GRAY) {
          const idx = stack.indexOf(next);
          const cycle = stack.slice(idx).concat(next);
          const key = [...cycle.slice(0, -1)].sort().join('|');
          if (!reported.has(key)) {
            reported.add(key);
            const chain = cycle.map(id => nodeMap.get(id)?.title?.trim() || id).join(' → ');
            issues.push({
              severity: ValidationSeverity.ERROR,
              message: `Cycle detected in runbook DAG: ${chain}`,
              nodeId: next,
            });
          }
        } else if (c === WHITE) {
          dfs(next, stack);
        }
      }
      stack.pop();
      color.set(nodeId, BLACK);
    };

    for (const n of nodes) {
      if (color.get(n.id) === WHITE) dfs(n.id, []);
    }
  }

  /**
   * For each privileged ssh node, the minimum number of enabled approval
   * nodes on any path from a root to it. A side branch that skips the
   * approval would otherwise reach sudo unapproved.
   */
  public checkPrivileged(
    nodes: WorkflowNode[],
    connections: WorkflowConnection[],
    required: number,
    issues: ValidationIssue[]
  ): void {
    const privileged = nodes.filter(
      n =>
        n.type === 'ssh' &&
        n.enabled !== false &&
        (n.config as Record<string, unknown> | undefined)?.privileged === true
    );
    if (privileged.length === 0) return;

    const byId = new Map(nodes.map(n => [n.id, n]));
    const parents = new Map<string, string[]>();
    for (const c of connections) {
      if (!byId.has(c.source) || !byId.has(c.target) || c.source === c.target) continue;
      parents.set(c.target, [...(parents.get(c.target) ?? []), c.source]);
    }
    const memo = new Map<string, number>();
    const visiting = new Set<string>();
    const minApprovals = (id: string): number => {
      const cached = memo.get(id);
      if (cached !== undefined) return cached;
      if (visiting.has(id)) return Infinity;
      visiting.add(id);
      const node = byId.get(id);
      const own = node?.type === 'approval' && node.enabled !== false ? 1 : 0;
      const ps = parents.get(id) ?? [];
      const upstream = ps.length === 0 ? 0 : Math.min(...ps.map(minApprovals));
      visiting.delete(id);
      const value = own + upstream;
      memo.set(id, value);
      return value;
    };

    for (const node of privileged) {
      const ps = parents.get(node.id) ?? [];
      const found = ps.length === 0 ? 0 : Math.min(...ps.map(minApprovals));
      if (found < required) {
        issues.push({
          severity: ValidationSeverity.ERROR,
          message:
            required === 1
              ? `Privileged SSH step "${node.title}" needs an approval step before it on every path`
              : `Privileged SSH step "${node.title}" needs ${required} approval steps before it on every path (found ${found})`,
          nodeId: node.id,
          field: 'privileged',
        });
      }
    }
  }
}
