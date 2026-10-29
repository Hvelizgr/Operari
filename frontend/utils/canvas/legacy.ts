import type { Connection, WorkflowNode } from '@operari/shared';

// Demo runbooks seeded before the canvas node shape was fixed were
// stored as { type: 'note' | <step>, data: { text | label, ... } } with
// no title, which the editor cannot save (the backend rejects nodes
// without a title). Self-host upgrades run `prisma db push`, not SQL
// migrations, so the rows are normalized when the editor loads them and
// the next autosave persists the fixed shape.
interface LegacyNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data?: Record<string, unknown>;
}

const isLegacy = (n: unknown): n is LegacyNode =>
  typeof n === 'object' &&
  n !== null &&
  !('title' in n) &&
  'data' in n &&
  typeof (n as LegacyNode).data === 'object';

export function normalizeLegacyNodes(
  nodes: unknown[],
  connections: Connection[]
): { nodes: WorkflowNode[]; connections: Connection[] } {
  if (!nodes.some(isLegacy)) {
    return { nodes: nodes as WorkflowNode[], connections };
  }

  const notes = new Set<string>();
  const normalized = nodes.map(n => {
    if (!isLegacy(n)) return n as WorkflowNode;
    const { label, ...config } = n.data ?? {};
    if (n.type === 'note' || n.type === 'custom.note') {
      notes.add(n.id);
      return { id: n.id, type: 'custom.note', title: 'Note', position: n.position, config };
    }
    return {
      id: n.id,
      type: n.type,
      title: typeof label === 'string' && label ? label : n.type,
      position: n.position,
      enabled: true,
      config,
      inputs: [{ id: 'in', label: 'Input' }],
      outputs: [{ id: 'out', label: 'Output' }],
    } as WorkflowNode;
  });

  // Notes have no ports on the canvas, so edges to or from them cannot render.
  return {
    nodes: normalized as WorkflowNode[],
    connections: connections.filter(c => !notes.has(c.source) && !notes.has(c.target)),
  };
}
