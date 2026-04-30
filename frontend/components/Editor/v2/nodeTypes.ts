import type { NodeTypes } from '@xyflow/react';

import { NODE_CATALOG } from './catalog';
import { BaseStepNode } from './nodes/BaseStepNode';
import { FrameNode } from './nodes/FrameNode';
import { NoteNode } from './nodes/NoteNode';

const SPECIAL: Record<string, NodeTypes[string]> = {
  'custom.frame': FrameNode,
  'custom.note': NoteNode,
};

const buildRegistry = (): NodeTypes => {
  const registry: NodeTypes = { ...SPECIAL };
  for (const type of NODE_CATALOG.keys()) {
    if (type in SPECIAL) continue;
    registry[type] = BaseStepNode;
  }
  // Fallback so an unknown type (loaded from a runbook authored by a
  // future plugin we do not have a definition for) still renders rather
  // than throwing. RF defaults to its `default` node when a type is
  // missing from this map.
  registry.default = BaseStepNode;
  return registry;
};

export const nodeTypes: NodeTypes = buildRegistry();
