/**
 * Dirtiness propagation (n8n parity).
 *
 * A node is "dirty" when its current shape differs from the snapshot
 * taken at the start of the most recent successful run — an operator
 * who tweaks a step's params after a successful run should NOT be
 * looking at run-console output that no longer reflects the current
 * config. Without a visible cue they will, and they'll trust it.
 *
 * Two direct triggers + one cascading rule:
 *   PARAMETERS_UPDATED         → node.config differs from snapshot
 *   INCOMING_CONNECTIONS_UPDATED → upstream wiring (set of source ids)
 *                                  differs from snapshot
 *   UPSTREAM_DIRTY             → cascades to every descendant of any
 *                                node already marked dirty by either of
 *                                the above (or by another upstream
 *                                cascade — transitive closure)
 *
 * The fingerprint deliberately excludes presentation-only fields
 * (position, title, parentId) so dragging a node or renaming it does
 * NOT mark it dirty. The pinned-output marker (`__pinnedOutput`) is
 * also excluded from the param fingerprint and tracked separately —
 * pinning a step is an explicit author signal, not an unintended
 * staleness.
 */

import type { RfEdge, RfNode } from './adapter';

export type DirtinessKind =
  | 'parameters-updated'
  | 'incoming-connections-updated'
  | 'pinned-data-updated'
  | 'upstream-dirty';

export interface NodeFingerprint {
  /** Hash of the node's persisted config minus presentation keys. */
  config: string;
  /** Hash of the upstream-source-ids set (sorted). */
  incoming: string;
  /** Pin presence marker — flips on pin add / remove / change. */
  pin: string;
}

export type DirtinessMap = Map<string, DirtinessKind>;

/** Build a fingerprint suitable for comparison against a prior snapshot. */
export function fingerprintNode(node: RfNode, edges: RfEdge[]): NodeFingerprint {
  const config = (node.data?.workflow?.config ?? {}) as Record<string, unknown>;
  // Strip pin marker from config hash — it has its own slot so the
  // UI can distinguish "you pinned this" from "you edited this".
  const { __pinnedOutput: pinnedOutput, ...configWithoutPin } = config;
  const incoming = edges
    .filter(e => e.target === node.id)
    .map(e => e.source)
    .sort()
    .join(',');
  return {
    config: stableStringify(configWithoutPin),
    incoming,
    pin: pinnedOutput === undefined ? '' : stableStringify(pinnedOutput),
  };
}

/**
 * Compute the dirtiness map for the current canvas given a snapshot
 * of fingerprints from the start of the most recent run. Returns a
 * map keyed by node id; nodes not in the map are clean.
 */
export function computeDirtinessMap(
  nodes: RfNode[],
  edges: RfEdge[],
  snapshot: Record<string, NodeFingerprint>
): DirtinessMap {
  const result: DirtinessMap = new Map();

  // Pass 1: direct triggers.
  for (const node of nodes) {
    const prior = snapshot[node.id];
    if (!prior) continue; // never ran in this snapshot — not dirty
    const current = fingerprintNode(node, edges);
    if (current.config !== prior.config) {
      result.set(node.id, 'parameters-updated');
    } else if (current.incoming !== prior.incoming) {
      result.set(node.id, 'incoming-connections-updated');
    } else if (current.pin !== prior.pin) {
      result.set(node.id, 'pinned-data-updated');
    }
  }

  if (result.size === 0) return result;

  // Pass 2: cascade. Walk descendants of every directly-dirty node
  // and mark them upstream-dirty — but only if they are not already
  // marked with a stronger reason (direct edits keep their kind).
  const childMap = new Map<string, string[]>();
  for (const edge of edges) {
    if (!childMap.has(edge.source)) childMap.set(edge.source, []);
    childMap.get(edge.source)!.push(edge.target);
  }

  const queue = Array.from(result.keys());
  while (queue.length > 0) {
    const id = queue.shift()!;
    const children = childMap.get(id) ?? [];
    for (const childId of children) {
      if (result.has(childId)) continue; // already marked
      result.set(childId, 'upstream-dirty');
      queue.push(childId);
    }
  }

  return result;
}

/**
 * JSON.stringify with stable key order so two equivalent objects
 * always hash the same regardless of key insertion order.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * Capture a fingerprint snapshot at run-start. Pass the result to
 * the editor store so subsequent renders can compare against it.
 */
export function captureSnapshot(nodes: RfNode[], edges: RfEdge[]): Record<string, NodeFingerprint> {
  const out: Record<string, NodeFingerprint> = {};
  for (const node of nodes) {
    out[node.id] = fingerprintNode(node, edges);
  }
  return out;
}
