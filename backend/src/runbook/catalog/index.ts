import type { PluginNodeMetadata } from '../plugins/loader';
import { AGENT_NODES } from './agents';
import { AI_NODES } from './ai';
import { AWS_NODES } from './aws';
import { DATABASE_NODES } from './databases';
import { DATA_NODES } from './data';
import type { CatalogNode } from './define';
import { DEVOPS_NODES } from './devops';
import { GOOGLE_NODES } from './google';
import { MESSAGING_NODES } from './messaging';
import { MONITORING_NODES } from './monitoring';
import { NETWORK_NODES } from './network';
import { PRODUCTIVITY_NODES } from './productivity';

export { CatalogExecutor, type CatalogNode, type CatalogProperty, isVisible } from './define';

/**
 * Built-in steps defined in code: one object per step carries its form,
 * its validation and its behaviour. The executor registry runs them and
 * the editor catalog is upserted from them at boot, so neither can drift
 * from the other the way the hand-written seed did.
 */
export const BUILTIN_CATALOG: CatalogNode[] = [
  ...AI_NODES,
  ...AGENT_NODES,
  ...DATA_NODES,
  ...NETWORK_NODES,
  ...MESSAGING_NODES,
  ...MONITORING_NODES,
  ...DEVOPS_NODES,
  ...PRODUCTIVITY_NODES,
  ...DATABASE_NODES,
  ...AWS_NODES,
  ...GOOGLE_NODES,
];

export function catalogMetadata(): PluginNodeMetadata[] {
  return BUILTIN_CATALOG.map(({ run: _run, ...meta }) => ({ ...meta, source: 'builtin' }));
}
