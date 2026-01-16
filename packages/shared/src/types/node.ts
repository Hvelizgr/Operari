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
    operator?: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty';
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
}

// Union type for all possible node configs
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
    | Record<string, unknown>;
