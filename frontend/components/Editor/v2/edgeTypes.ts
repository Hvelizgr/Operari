import type { EdgeTypes } from '@xyflow/react';

import { SmartBezierEdge } from './edges/SmartBezierEdge';

export const edgeTypes: EdgeTypes = {
  smart: SmartBezierEdge,
};

export const DEFAULT_EDGE_TYPE = 'smart';
