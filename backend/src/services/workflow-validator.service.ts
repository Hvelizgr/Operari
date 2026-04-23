import { WorkflowDefinition, WorkflowNode, WorkflowConnection } from '../types/workflow.types';

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

export class WorkflowValidatorService {
  /**
   * Validate a workflow definition
   */
  public validate(workflow: WorkflowDefinition): ValidationResult {
    const issues: ValidationIssue[] = [];

    // 1. Basic empty check
    if (!workflow.nodes || workflow.nodes.length === 0) {
      return {
        isValid: true, // Allow saving empty workflows, but warn
        issues: [{ severity: ValidationSeverity.WARNING, message: 'Workflow is empty' }],
      };
    }

    // 2. Trigger check
    this.checkTriggers(workflow.nodes, issues);

    // 3. Orphan check
    this.checkOrphans(workflow.nodes, workflow.connections, issues);

    // 4. Configuration check
    this.checkConfigurations(workflow.nodes, issues);

    // 5. Connection validity
    this.checkConnections(workflow.nodes, workflow.connections, issues);

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
    const triggerTypes = ['Trigger', 'Webhook', 'Schedule'];
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
      const config = (node.config as any) || {};

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
            // often schedule is on the workflow level, but if it's a node...
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
}
