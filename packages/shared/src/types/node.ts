/**
 * Node configuration types shared between frontend and backend
 */

// =============================================================================
// Node Port
// =============================================================================

export interface NodePort {
  id: string;
  label: string;
}

// =============================================================================
// Node Type Categories
// =============================================================================

export type NodeCategory =
  | 'triggers'
  | 'core'
  | 'ai'
  | 'flow'
  | 'data'
  | 'social'
  | 'communication'
  | 'marketing'
  | 'productivity'
  | 'storage'
  | 'finance'
  | 'developer';

// =============================================================================
// Node Type Definition (for palette/catalog)
// =============================================================================

export interface NodeTypeDefinition {
  type: string;
  label: string;
  category: NodeCategory;
  description?: string;
  icon?: string;
  color?: string;
  inputs?: NodePort[];
  outputs?: NodePort[];
  defaultConfig?: Record<string, unknown>;
}

// =============================================================================
// Node Configs (specific configurations for different node types)
// =============================================================================

export interface HttpNodeConfig {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  retries?: number;
}

export interface EmailNodeConfig {
  to?: string;
  subject?: string;
  body?: string;
  html?: string;
}

export interface TransformNodeConfig {
  code?: string;
  mapping?: Record<string, string>;
}

export interface ConditionNodeConfig {
  condition?: string;
  field?: string;
  operator?:
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'greaterThan'
    | 'lessThan'
    | 'isEmpty'
    | 'isNotEmpty';
  value?: string;
}

export interface DatabaseNodeConfig {
  operation?: 'select' | 'insert' | 'update' | 'delete';
  table?: string;
  query?: string;
  data?: Record<string, unknown>;
}

export interface DelayNodeConfig {
  duration?: number;
}

export interface LoopNodeConfig {
  items?: unknown[];
  itemsPath?: string;
}

export interface WebhookNodeConfig {
  path?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

export interface ScheduleNodeConfig {
  cron?: string;
  timezone?: string;
}

export interface NoteNodeConfig {
  text?: string;
  /** Rendered width in canvas px. Optional — the Note component falls
   *  back to a 275px default when unset. */
  width?: number;
  /** Rendered height in canvas px. Defaults to 200px. */
  height?: number;
}

export interface FrameNodeConfig {
  /** Display label rendered in the frame's title bar. Defaults to
   *  "Frame" when unset so the node is still clickable. */
  title?: string;
  /** Canvas-space width. The frame component enforces a sane minimum
   *  at edit time; the type doesn't so that older runbooks with tiny
   *  frames still load. */
  width?: number;
  height?: number;
  /** Accent color as a CSS hex string. Drives the border + title-bar
   *  tint. Defaults to the brand emerald `#3ecf8e`. */
  color?: string;
}

/**
 * Meta-keys stored inside every execution-capable node's config. The
 * editor's PropertiesPanel writes these via the shared MetaPanel; the
 * runbook YAML serializer promotes them to top-level retry/runIf/skipIf
 * fields at the spec boundary. Listed here so a discriminated-union
 * variant can intersect with `NodeExecutionMeta` to pick them up
 * without repeating the three fields on every config type.
 */
export interface NodeExecutionMeta {
  /** Retry policy. `count` is the maximum extra attempts on failure;
   *  0 or missing means no retry. */
  _retry?: { count?: number; backoff?: 'fixed' | 'exponential'; delayMs?: number };
  /** CEL-lite expression evaluated before the node runs; falsy skips
   *  execution and routes the run as if the node completed. */
  _runIf?: string;
  /** Same as `_runIf` but with inverted semantics — truthy skips. */
  _skipIf?: string;
}

// Union type for all possible node configs.
//
// The final `Record<string, unknown>` branch is a deliberate escape
// hatch: runtime node types registered via the SDK plugin system
// aren't known at compile time, so their configs land here and get
// narrowed by runtime dispatchers (NodeExecutorService) instead of
// the TypeScript compiler. Every named variant above is preferable
// when the node.type is known at the call site.
export type NodeConfig =
  | HttpNodeConfig
  | EmailNodeConfig
  | TransformNodeConfig
  | ConditionNodeConfig
  | DatabaseNodeConfig
  | DelayNodeConfig
  | LoopNodeConfig
  | WebhookNodeConfig
  | ScheduleNodeConfig
  | NoteNodeConfig
  | FrameNodeConfig
  | Record<string, unknown>;
