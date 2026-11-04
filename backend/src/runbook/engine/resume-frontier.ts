/**
 * Branch selection and the resume frontier, shared by the live engine and
 * the event-log replay so both follow exactly the same edges.
 */

export interface FrontierNode {
  id: string;
  type: string;
  outputs?: unknown[];
}

export interface FrontierConnection {
  source: string;
  target: string;
  sourcePort?: number;
}

const CONDITION_TYPES = new Set(['Condition', 'If', 'operari.if']);
const SWITCH_TYPES = new Set(['Switch', 'operari.switch']);
export const LOOP_TYPES = new Set(['Loop', 'Iterator', 'operari.loop']);

/**
 * Outgoing connections a finished node actually takes: the true or false
 * port of a condition, the matched port of a switch (no match → the last,
 * "default" port), every connection otherwise.
 */
export function followedConnections<C extends FrontierConnection>(
  node: FrontierNode,
  output: unknown,
  connections: C[]
): C[] {
  const outgoing = connections.filter(c => c.source === node.id);
  const out = output && typeof output === 'object' ? (output as Record<string, unknown>) : null;
  if (CONDITION_TYPES.has(node.type) && out) {
    const passed = Boolean(out.conditionResult);
    // Connections without a port follow the true branch (older runbooks).
    return outgoing.filter(c =>
      passed ? c.sourcePort === 0 || c.sourcePort === undefined : c.sourcePort === 1
    );
  }
  if (SWITCH_TYPES.has(node.type) && out) {
    const matchedCase = out.matchedCase as number | undefined;
    if (matchedCase === undefined) return outgoing;
    const outputCount = Array.isArray(node.outputs) ? node.outputs.length : 0;
    const port = matchedCase === -1 && outputCount > 1 ? outputCount - 1 : matchedCase;
    return outgoing.filter(c => c.sourcePort === port || c.sourcePort === undefined);
  }
  return outgoing;
}

export type ResumeFrontier<N> = { frontier: N[] } | { abandon: string };

/**
 * Nodes to run next when a run is resumed from its event log: children
 * reached through the branches the finished nodes took, once every parent
 * is done, plus start nodes that never finished (a crash before the first
 * step completed). A loop that already started cannot be resumed mid
 * iteration, so it abandons the run.
 */
export function resumeFrontier<N extends FrontierNode, C extends FrontierConnection>(params: {
  nodes: N[];
  connections: C[];
  done: Set<string>;
  outputs: Record<string, unknown>;
  startNodes: N[];
}): ResumeFrontier<N> {
  const { nodes, connections, done, outputs, startNodes } = params;
  const loop = nodes.find(n => LOOP_TYPES.has(n.type) && done.has(n.id));
  if (loop) {
    return { abandon: `loop step ${loop.id} had started; resuming mid-iteration is not supported` };
  }
  const byId = new Map(nodes.map(n => [n.id, n]));
  const frontier = new Map<string, N>();
  for (const id of done) {
    const node = byId.get(id);
    if (!node) continue;
    for (const conn of followedConnections(node, outputs[id], connections)) {
      const child = byId.get(conn.target);
      if (!child || done.has(child.id)) continue;
      const parents = connections.filter(c => c.target === child.id);
      if (parents.every(p => done.has(p.source))) frontier.set(child.id, child);
    }
  }
  for (const start of startNodes) {
    if (!done.has(start.id)) frontier.set(start.id, start);
  }
  return { frontier: Array.from(frontier.values()) };
}
