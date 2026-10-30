import { WorkflowNode } from '@operari/shared';

import { ExecutionMetric, ViewportState } from '../../types/editor.types';
import { NodeType } from '../Node';

/**
 * Build the runtime shape of a freshly-instantiated node from its
 * NodeType declaration in the palette. The previous version hardcoded
 * `inputs: [{id:'in'}]` / `outputs: [{id:'out'}]` and ignored every
 * `properties[]` declared in the palette, so each new node landed on
 * the canvas with `config: undefined` and the operator had to fill in
 * every field by hand. This helper now applies the palette defaults so
 * a freshly-dropped `shell` already has `command: 'echo "hello..."'`,
 * an `approval` has both `approved` and `rejected` outputs, and so on.
 */
// The seeded catalog declares ports as `{ name, type }`; older palette
// entries use bare strings. An object label would reach JSX and crash.
export function portLabel(port: unknown, fallback: string): string {
  if (typeof port === 'string') return port;
  if (port && typeof port === 'object' && typeof (port as { name?: unknown }).name === 'string') {
    return (port as { name: string }).name;
  }
  return fallback;
}

function applyNodeTypeDefaults(nodeType: NodeType): {
  config: Record<string, unknown>;
  inputs: Array<{ id: string; label: string }>;
  outputs: Array<{ id: string; label: string }>;
} {
  const config: Record<string, unknown> = {};
  if (Array.isArray(nodeType.properties)) {
    for (const prop of nodeType.properties) {
      if (prop && typeof prop === 'object' && 'name' in prop && 'default' in prop) {
        if (prop.default !== undefined) {
          config[prop.name as string] = prop.default;
        }
      }
    }
  }
  const inputs =
    Array.isArray(nodeType.inputs) && nodeType.inputs.length > 0
      ? nodeType.inputs.map((port: unknown, i: number) => ({
          id: `in-${i}`,
          label: portLabel(port, `in-${i}`),
        }))
      : [{ id: 'in', label: 'Input' }];
  const outputs =
    Array.isArray(nodeType.outputs) && nodeType.outputs.length > 0
      ? nodeType.outputs.map((port: unknown, i: number) => ({
          id: `out-${i}`,
          label: portLabel(port, `out-${i}`),
        }))
      : [{ id: 'out', label: 'Output' }];
  return { config, inputs, outputs };
}

// Use a counter on top of Date.now() so two nodes dropped in the same
// millisecond don't collide on id (a real risk after a duplicate or a
// quick template import).
let _nodeIdCounter = 0;
function nextNodeId(): string {
  _nodeIdCounter += 1;
  return `node-${Date.now()}-${_nodeIdCounter}`;
}

export const createNewNode = (
  nodeType: NodeType,
  viewport: ViewportState,
  windowSize: { width: number; height: number },
  lang: 'en' | 'es'
): WorkflowNode => {
  const centerX = (windowSize.width / 2 - viewport.x) / viewport.zoom;
  const centerY = (windowSize.height / 2 - viewport.y) / viewport.zoom;
  const { config, inputs, outputs } = applyNodeTypeDefaults(nodeType);
  return {
    id: nextNodeId(),
    position: { x: centerX - 128, y: centerY - 32 },
    title: nodeType.label[lang],
    type: nodeType.type,
    config,
    inputs,
    outputs,
  };
};

export const createDroppedNode = (
  nodeType: NodeType,
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  viewport: ViewportState,
  lang: 'en' | 'es'
): WorkflowNode => {
  const x = (clientX - canvasRect.left - viewport.x) / viewport.zoom;
  const y = (clientY - canvasRect.top - viewport.y) / viewport.zoom;
  const { config, inputs, outputs } = applyNodeTypeDefaults(nodeType);

  return {
    id: nextNodeId(),
    position: { x, y },
    title: nodeType.label[lang],
    type: nodeType.type,
    config,
    inputs,
    outputs,
  };
};

export const generateExecutionMetrics = (
  updatedNodes: WorkflowNode[],
  prevNodes: WorkflowNode[]
): ExecutionMetric[] => {
  const newMetrics: ExecutionMetric[] = [];

  updatedNodes.forEach(updatedNode => {
    const prevNode = prevNodes.find(n => n.id === updatedNode.id);

    if (
      prevNode?.executionState === 'running' &&
      (updatedNode.executionState === 'success' || updatedNode.executionState === 'error')
    ) {
      newMetrics.push({
        nodeId: updatedNode.id,
        nodeName: updatedNode.title,
        executionTime: Math.floor(Math.random() * 1000) + 500, // Mock time
        status: updatedNode.executionState,
        timestamp: Date.now(),
      });
    }
  });

  return newMetrics;
};

/**
 * Output ports for a Switch step: one per case plus a trailing "default",
 * which the engine follows when nothing matches. Parses `cases` the same
 * way the backend does; returns null while the text is not a usable list
 * so a half-typed edit does not drop the existing ports.
 */
export function switchOutputs(cases: unknown): Array<{ id: string; label: string }> | null {
  let list: unknown = cases;
  if (typeof cases === 'string') {
    try {
      list = cases.trim() ? JSON.parse(cases) : [];
    } catch {
      return null;
    }
  }
  if (!Array.isArray(list)) return null;
  const labels = list.map((c, i) => {
    if (c && typeof c === 'object') {
      const { label, value } = c as { label?: unknown; value?: unknown };
      return String(label ?? value ?? `case ${i}`);
    }
    return String(c);
  });
  return [...labels, 'default'].map((label, i) => ({ id: `out-${i}`, label }));
}
