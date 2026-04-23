/**
 * Kahn's topological sort for DAG execution.
 *
 * Before this util, runWorkflow() used a greedy queue that walked
 * children of every finished step and re-queued any node whose
 * parents hadn't all finished yet. That worked, but had two real
 * costs:
 *
 *   1. Busy-spin on multi-parent joins: a node with 3 parents was
 *      popped + skipped twice before the 3rd parent completed.
 *   2. Non-deterministic execution order for independent branches,
 *      which made audit-trail comparisons and step re-ordering bugs
 *      harder to reason about.
 *
 * Kahn's algorithm gives us a static execution plan before we start:
 * pick any node whose in-degree is 0, emit it, decrement children.
 * Result is a topological order where every node appears after all
 * its predecessors. The engine walks the order once; joins
 * automatically wait until their turn comes up.
 *
 * Semantics preserved vs the old queue loop:
 *   - `startNodeIds` (optional) restricts the sort to the sub-DAG
 *     reachable from those nodes. The engine uses this for replay /
 *     resume / "start from node X" actions.
 *   - A cycle triggers a clear error. WorkflowValidatorService
 *     already rejects these at save time (A2), so this path is only
 *     reached for legacy rows whose cycle the validator missed — we
 *     fail loud rather than loop forever.
 *   - Nodes not reachable from any starter are dropped; the engine's
 *     existing orphan behavior treated them as no-ops anyway.
 */

export interface TopoNode {
  id: string;
}

export interface TopoEdge {
  source: string;
  target: string;
}

export class DagCycleError extends Error {
  constructor(
    public readonly pendingNodeIds: string[],
    message?: string
  ) {
    super(
      message ??
        `Cycle detected in DAG; cannot topologically sort. Remaining nodes: ${pendingNodeIds.join(', ')}`
    );
    this.name = 'DagCycleError';
  }
}

export interface TopologicalSortOptions {
  /**
   * Restrict the sort to nodes reachable from this set. Useful for
   * "start from node X" replays — the engine does not want to emit
   * siblings that sit on a different branch. Omit to sort the whole
   * DAG.
   */
  startNodeIds?: string[];
}

export function topologicalSort(
  nodes: TopoNode[],
  edges: TopoEdge[],
  options: TopologicalSortOptions = {}
): string[] {
  const nodeIds = new Set(nodes.map(n => n.id));

  // Build adjacency + in-degree over the subgraph reachable from
  // startNodeIds (or the whole graph when not specified). We could
  // do this in one pass over `edges`, but the reachability pre-walk
  // is cheap and keeps the Kahn loop honest.
  const reachable = resolveReachable(nodes, edges, options.startNodeIds);
  const children = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of reachable) {
    children.set(id, []);
    inDegree.set(id, 0);
  }
  for (const edge of edges) {
    // Skip self-loops and edges to unknown nodes — WorkflowValidator
    // reports those separately; this pass just needs a clean graph.
    if (edge.source === edge.target) continue;
    if (!reachable.has(edge.source) || !reachable.has(edge.target)) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    children.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // Seed queue with every reachable node whose in-degree is 0 —
  // typically the triggers. We sort for determinism so two runs of
  // the same runbook produce the same order without relying on
  // Map/Set insertion order.
  const queue: string[] = [];
  for (const id of reachable) {
    if ((inDegree.get(id) ?? 0) === 0) queue.push(id);
  }
  queue.sort();

  const order: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    order.push(nodeId);
    for (const child of children.get(nodeId) ?? []) {
      const next = (inDegree.get(child) ?? 0) - 1;
      inDegree.set(child, next);
      if (next === 0) {
        // Preserve determinism by inserting in sorted position rather
        // than always at the end. Cheap for small DAGs; the largest
        // runbook we expect is a few hundred nodes.
        insertSorted(queue, child);
      }
    }
  }

  if (order.length !== reachable.size) {
    // Every reachable node should have been emitted. Anything
    // remaining sits inside a cycle (positive in-degree that never
    // dropped to 0).
    const pending = Array.from(reachable).filter(id => !order.includes(id));
    throw new DagCycleError(pending);
  }

  return order;
}

function resolveReachable(
  nodes: TopoNode[],
  edges: TopoEdge[],
  startNodeIds: string[] | undefined
): Set<string> {
  const allIds = new Set(nodes.map(n => n.id));
  if (!startNodeIds || startNodeIds.length === 0) return allIds;

  // BFS outward from starters. Any node not in the forward reach is
  // dropped from the plan — the engine does not need a pre-order for
  // siblings on an unrelated branch when resuming from a specific
  // node.
  const adjacency = new Map<string, string[]>();
  for (const id of allIds) adjacency.set(id, []);
  for (const edge of edges) {
    if (!allIds.has(edge.source) || !allIds.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
  }
  const reachable = new Set<string>();
  const queue = [...startNodeIds.filter(id => allIds.has(id))];
  for (const id of queue) reachable.add(id);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adjacency.get(cur) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  return reachable;
}

function insertSorted(list: string[], value: string): void {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (list[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  list.splice(lo, 0, value);
}
