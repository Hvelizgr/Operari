import { NODE_TYPES, type NodeType } from '@/components/Node/NodePalette';

export const NODE_CATALOG: Map<string, NodeType> = new Map(NODE_TYPES.map(nt => [nt.type, nt]));

export const defaultConfigForType = (type: string): Record<string, unknown> => {
  const def = NODE_CATALOG.get(type);
  if (!def?.properties) return {};
  return def.properties.reduce<Record<string, unknown>>((acc, prop) => {
    if (prop.default !== undefined) acc[prop.name] = prop.default;
    return acc;
  }, {});
};
