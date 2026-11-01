import type { CatalogNode } from '../define';
import { COMMERCE_NODES } from './commerce';
import { COMMUNICATION_NODES } from './communication';
import { CRM_NODES } from './crm';
import { DEVTOOLS_NODES } from './devtools';
import { MARKETING_NODES } from './marketing';
import { OPS_AI_NODES } from './ops-ai';
import { PROJECT_NODES } from './project';
import { SUPPORT_NODES } from './support';
import { WORKSPACE_NODES } from './workspace';

/** Multi-operation integrations built with `service()`. */
export const SERVICE_NODES: CatalogNode[] = [
  ...COMMERCE_NODES,
  ...CRM_NODES,
  ...MARKETING_NODES,
  ...PROJECT_NODES,
  ...DEVTOOLS_NODES,
  ...COMMUNICATION_NODES,
  ...WORKSPACE_NODES,
  ...SUPPORT_NODES,
  ...OPS_AI_NODES,
];
