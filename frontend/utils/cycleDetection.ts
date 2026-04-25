import type { Connection, WorkflowNode } from '@nanorun/shared';

export function hasCycle(
  nodes: WorkflowNode[],
  connections: Connection[]
): { hasCycle: boolean; cyclePath?: string[] } {
  const nodeIds = new Set(nodes.map(n => n.id));
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  const dfs = (nodeId: string): string[] | null => {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = connections.filter(c => c.source === nodeId).map(c => c.target);

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cyclePath = dfs(neighbor);
        if (cyclePath) return cyclePath;
      } else if (recursionStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        return path.slice(cycleStart).concat(neighbor);
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
    return null;
  };

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      const cyclePath = dfs(nodeId);
      if (cyclePath) {
        return { hasCycle: true, cyclePath };
      }
    }
  }

  return { hasCycle: false };
}

export function getCyclicConnections(connections: Connection[], cyclePath: string[]): string[] {
  const cycleSet = new Set(cyclePath);
  return connections.filter(c => cycleSet.has(c.source) && cycleSet.has(c.target)).map(c => c.id);
}
