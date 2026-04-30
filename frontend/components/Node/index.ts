export { default as DynamicNodeForm } from './DynamicNodeForm';
export { default as NodeConfigPanel } from './NodeConfigPanel';
// Step catalog moved to the V2 namespace at the cutover; re-exported
// here so external consumers (Navigation/SearchBar) keep working
// without churning their import paths.
export type { NodeType } from '@/components/Editor/canvas/stepCatalog';
export { CATEGORIES, NODE_TYPES } from '@/components/Editor/canvas/stepCatalog';
