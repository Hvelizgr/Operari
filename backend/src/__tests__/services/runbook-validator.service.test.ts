import {
  ValidationSeverity,
  RunbookValidatorService,
} from '../../services/runbook-validator.service';
import type {
  WorkflowConnection,
  WorkflowDefinition,
  WorkflowNode,
} from '../../types/runbook.types';

const node = (id: string, type: WorkflowNode['type'] = 'HTTP'): WorkflowNode => ({
  id,
  type,
  title: id,
  position: { x: 0, y: 0 },
  config: type === 'HTTP' ? { url: 'https://example.com' } : {},
});

const edge = (source: string, target: string): WorkflowConnection => ({
  id: `${source}-${target}`,
  source,
  target,
});

const wf = (nodes: WorkflowNode[], connections: WorkflowConnection[]): WorkflowDefinition => ({
  name: 'test',
  nodes,
  connections,
});

describe('RunbookValidatorService.checkCycles', () => {
  const validator = new RunbookValidatorService();

  it('accepts a simple straight-line DAG', () => {
    const result = validator.validate(
      wf([node('a', 'Trigger'), node('b'), node('c')], [edge('a', 'b'), edge('b', 'c')])
    );
    expect(result.isValid).toBe(true);
    expect(result.issues.filter(i => i.message.includes('Cycle'))).toHaveLength(0);
  });

  it('accepts a diamond (branching + join) without reporting a cycle', () => {
    //      a
    //     / \
    //    b   c
    //     \ /
    //      d
    const result = validator.validate(
      wf(
        [node('a', 'Trigger'), node('b'), node('c'), node('d')],
        [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')]
      )
    );
    expect(result.issues.filter(i => i.message.includes('Cycle'))).toHaveLength(0);
  });

  it('detects a simple A→B→A cycle', () => {
    const result = validator.validate(
      wf([node('a', 'Trigger'), node('b')], [edge('a', 'b'), edge('b', 'a')])
    );
    const cycleIssues = result.issues.filter(i => i.message.includes('Cycle'));
    expect(cycleIssues).toHaveLength(1);
    expect(cycleIssues[0].severity).toBe(ValidationSeverity.ERROR);
    expect(cycleIssues[0].message).toMatch(/a\b/);
    expect(cycleIssues[0].message).toMatch(/b\b/);
    expect(result.isValid).toBe(false);
  });

  it('detects a longer A→B→C→A cycle and includes every node in the chain', () => {
    const result = validator.validate(
      wf(
        [node('a', 'Trigger'), node('b'), node('c')],
        [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')]
      )
    );
    const cycleIssues = result.issues.filter(i => i.message.includes('Cycle'));
    expect(cycleIssues).toHaveLength(1);
    const msg = cycleIssues[0].message;
    expect(msg).toMatch(/a.*→.*b.*→.*c.*→.*a/);
  });

  it('reports two disjoint cycles separately', () => {
    const result = validator.validate(
      wf(
        [
          node('a', 'Trigger'),
          node('b'),
          node('c'),
          node('d'),
          // second disjoint cycle component
          node('x'),
          node('y'),
        ],
        [
          edge('a', 'b'),
          edge('b', 'c'),
          edge('c', 'a'), // cycle 1
          edge('d', 'b'), // dangling entry into cycle 1 — still one cycle
          edge('x', 'y'),
          edge('y', 'x'), // cycle 2
        ]
      )
    );
    const cycleIssues = result.issues.filter(i => i.message.includes('Cycle'));
    expect(cycleIssues).toHaveLength(2);
  });

  it('does not double-report the same cycle from multiple entry points', () => {
    // External edges d→a and e→b both lead into the a→b→c→a cycle.
    // checkCycles must report the cycle exactly once.
    const result = validator.validate(
      wf(
        [node('a', 'Trigger'), node('b'), node('c'), node('d'), node('e')],
        [edge('d', 'a'), edge('e', 'b'), edge('a', 'b'), edge('b', 'c'), edge('c', 'a')]
      )
    );
    const cycleIssues = result.issues.filter(i => i.message.includes('Cycle'));
    expect(cycleIssues).toHaveLength(1);
  });

  it('ignores self-loops (already reported by checkConnections)', () => {
    const result = validator.validate(wf([node('a', 'Trigger')], [edge('a', 'a')]));
    const cycleIssues = result.issues.filter(i => i.message.includes('Cycle'));
    // Self-loop is reported only once, as a WARNING by the connection
    // pass — not again as a cycle ERROR.
    expect(cycleIssues).toHaveLength(0);
    expect(result.issues.some(i => /Self-referencing/.test(i.message))).toBe(true);
  });

  it('ignores edges pointing to unknown nodes (checkConnections will flag them)', () => {
    const result = validator.validate(
      wf([node('a', 'Trigger'), node('b')], [edge('a', 'b'), edge('b', 'ghost')])
    );
    const cycleIssues = result.issues.filter(i => i.message.includes('Cycle'));
    expect(cycleIssues).toHaveLength(0);
  });

  it('marks the workflow invalid when a cycle is present', () => {
    const result = validator.validate(
      wf([node('a', 'Trigger'), node('b')], [edge('a', 'b'), edge('b', 'a')])
    );
    expect(result.isValid).toBe(false);
  });

  it('handles larger branching DAGs without false positives', () => {
    // Wide fan-out, single sink. No cycles.
    const nodes = [node('root', 'Trigger')];
    const connections: WorkflowConnection[] = [];
    for (let i = 0; i < 20; i++) {
      nodes.push(node(`leaf-${i}`));
      connections.push(edge('root', `leaf-${i}`));
    }
    nodes.push(node('sink'));
    for (let i = 0; i < 20; i++) {
      connections.push(edge(`leaf-${i}`, 'sink'));
    }
    const result = validator.validate(wf(nodes, connections));
    const cycleIssues = result.issues.filter(i => i.message.includes('Cycle'));
    expect(cycleIssues).toHaveLength(0);
  });
});
