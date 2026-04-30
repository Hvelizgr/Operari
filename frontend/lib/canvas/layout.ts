import type { RfEdge, RfNode } from './adapter';

const DEFAULT_NODE_W = 240;
const DEFAULT_NODE_H = 120;

interface ElkNode {
  id: string;
  width?: number;
  height?: number;
  children?: ElkNode[];
  layoutOptions?: Record<string, string>;
  x?: number;
  y?: number;
}

interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
}

interface ElkGraph {
  id: string;
  layoutOptions: Record<string, string>;
  children: ElkNode[];
  edges: ElkEdge[];
}

interface ElkResult extends ElkNode {
  children?: ElkResult[];
}

export interface AutoLayoutOptions {
  /** 'RIGHT' | 'DOWN' | 'LEFT' | 'UP'. Default 'RIGHT' for runbooks
   *  because a left-to-right flow matches the way operators read a
   *  sequence of steps. */
  direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
  /** Spacing between nodes within a layer. */
  nodeSpacing?: number;
  /** Spacing between layers. */
  layerSpacing?: number;
}

const FRAME_PADDING = 20;

/**
 * Run elkjs's `layered` algorithm against the runbook graph, fully
 * supporting frame nesting (compound nodes). The resulting positions
 * are written back to the input nodes (immutably) — we don't touch
 * edges because RF re-routes from the new endpoints automatically.
 *
 * Frames keep their own dimensions if the user resized them, but get
 * a sensible default if they were never measured. Children are laid
 * out relative to the frame origin (parent-local coordinates), which
 * is the same convention `extent: 'parent'` uses everywhere else in
 * the codebase.
 *
 * elkjs runs synchronously in the JS thread on graphs of this size
 * (a few hundred nodes max for runbooks). For larger graphs the
 * library supports a web-worker variant; defer until we hit a real
 * scale problem.
 */
export const computeAutoLayout = async (
  nodes: RfNode[],
  edges: RfEdge[],
  options: AutoLayoutOptions = {}
): Promise<RfNode[]> => {
  const direction = options.direction ?? 'RIGHT';
  const nodeSpacing = options.nodeSpacing ?? 60;
  const layerSpacing = options.layerSpacing ?? 80;

  // Build the parent → children map so we can recursively assemble
  // the elk tree. Top-level nodes have no parentId.
  const childrenByParent = new Map<string | null, RfNode[]>();
  for (const n of nodes) {
    const key = n.parentId ?? null;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(n);
  }

  const buildElkChildren = (parentId: string | null): ElkNode[] => {
    const here = childrenByParent.get(parentId) ?? [];
    return here.map(n => {
      const measured = n.measured;
      const width = measured?.width ?? (typeof n.width === 'number' ? n.width : DEFAULT_NODE_W);
      const height = measured?.height ?? (typeof n.height === 'number' ? n.height : DEFAULT_NODE_H);
      const grandkids = buildElkChildren(n.id);
      return {
        id: n.id,
        width,
        height,
        ...(grandkids.length > 0
          ? {
              children: grandkids,
              layoutOptions: {
                'elk.padding': `[top=${FRAME_PADDING + 24},left=${FRAME_PADDING},bottom=${FRAME_PADDING},right=${FRAME_PADDING}]`,
              },
            }
          : {}),
      };
    });
  };

  const graph: ElkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.layered.spacing.nodeNodeBetweenLayers': String(layerSpacing),
      'elk.spacing.nodeNode': String(nodeSpacing),
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    },
    children: buildElkChildren(null),
    edges: edges.map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  // Lazy import keeps elkjs (~80kB) out of the editor's initial chunk.
  const ELKModule = (await import('elkjs/lib/elk.bundled.js')).default;
  const elk = new ELKModule();
  const result = (await elk.layout(graph)) as ElkResult;

  // Walk the elk tree and apply x / y back to the matching node. Each
  // child's position is *relative to its parent* in elk's output,
  // which matches the parent-local convention `extent: 'parent'`
  // already uses.
  const positions = new Map<string, { x: number; y: number }>();
  const walk = (subtree: ElkResult) => {
    if (!subtree.children) return;
    for (const child of subtree.children) {
      if (typeof child.x === 'number' && typeof child.y === 'number') {
        positions.set(child.id, { x: child.x, y: child.y });
      }
      walk(child);
    }
  };
  walk(result);

  return nodes.map(n => {
    const next = positions.get(n.id);
    return next ? { ...n, position: next } : n;
  });
};
