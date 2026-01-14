import { z } from 'zod';

// =============================================================================
// Node Port Types
// =============================================================================

export interface NodePort {
    id: string;
    label: string;
}

export const nodePortSchema = z.object({
    id: z.string(),
    label: z.string(),
});

// =============================================================================
// Node Position
// =============================================================================

export interface NodePosition {
    x: number;
    y: number;
}

export const nodePositionSchema = z.object({
    x: z.number(),
    y: z.number(),
});

// =============================================================================
// Node Config Types (specific configurations for different node types)
// =============================================================================

export interface HttpNodeConfig {
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: unknown;
    retries?: number; // Number of retry attempts for failed HTTP requests
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

export interface N8nNodeConfig {
    workflowId?: string;           // ID del workflow de n8n a ejecutar
    workflowName?: string;         // Nombre para mostrar
    waitForCompletion?: boolean;   // Esperar a que termine la ejecución
    timeout?: number;              // Timeout en ms
    inputMapping?: Record<string, string>; // Mapeo de inputs
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
    | N8nNodeConfig
    | Record<string, unknown>;

// Zod schema for generic node config (flexible but validated)
export const nodeConfigSchema = z.record(z.string(), z.unknown()).optional();

// =============================================================================
// Workflow Node
// =============================================================================

export type WorkflowNodeType =
    | 'Webhook'
    | 'Trigger'
    | 'Schedule'
    | 'HTTP'
    | 'Api'
    | 'Email'
    | 'Transform'
    | 'Code'
    | 'Condition'
    | 'If'
    | 'Database'
    | 'SQL'
    | 'Delay'
    | 'Wait'
    | 'Loop'
    | 'Iterator'
    | 'n8n'
    | string; // Allow custom types

export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    title: string;
    position: NodePosition;
    config?: NodeConfig;
    inputs?: NodePort[];
    outputs?: NodePort[];
}

export const workflowNodeSchema = z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    title: z.string().min(1),
    position: nodePositionSchema,
    config: nodeConfigSchema,
    inputs: z.array(nodePortSchema).optional(),
    outputs: z.array(nodePortSchema).optional(),
});

// =============================================================================
// Workflow Connection
// =============================================================================

export interface WorkflowConnection {
    id: string;
    source: string;      // Source node ID
    target: string;      // Target node ID
    sourcePort?: number; // Index of source port
    targetPort?: number; // Index of target port
}

export const workflowConnectionSchema = z.object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    sourcePort: z.number().int().min(0).optional(),
    targetPort: z.number().int().min(0).optional(),
});

// =============================================================================
// Workflow Definition (full workflow data)
// =============================================================================

export interface WorkflowDefinition {
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
    isActive?: boolean;
    schedule?: string;
}

export const workflowDefinitionSchema = z.object({
    name: z.string().min(1).optional().default('Untitled Workflow'),
    description: z.string().optional(),
    nodes: z.array(workflowNodeSchema),
    connections: z.array(workflowConnectionSchema),
    isActive: z.boolean().optional(),
    schedule: z.string().optional(),
});

// =============================================================================
// Execution Context
// =============================================================================

export interface ExecutionInput {
    [key: string]: unknown;
}

export interface ExecutionOutput {
    [key: string]: unknown;
}

export interface ExecutionContext {
    workflowId: string;
    executionId: string;
    input: ExecutionInput;
    output: ExecutionOutput;
}

// =============================================================================
// Node Execution Results
// =============================================================================

export interface TriggerResult extends ExecutionOutput {
    triggered: boolean;
    timestamp: string;
}

export interface HttpResult extends ExecutionOutput {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: unknown;
}

export interface EmailResult extends ExecutionOutput {
    messageId: string;
    accepted: string[];
    rejected: string[];
}

export interface ConditionResult extends ExecutionOutput {
    conditionResult: boolean;
}

export interface DelayResult extends ExecutionOutput {
    delayed: boolean;
    duration: number;
}

export interface LoopResult extends ExecutionOutput {
    items: unknown[];
    count: number;
}

export interface DatabaseResult extends ExecutionOutput {
    operation?: string;
    table?: string;
    query: string;
    data: unknown;
    message: string;
}

export interface N8nResult extends ExecutionOutput {
    executionId: string;
    workflowId: string;
    status: 'success' | 'error' | 'waiting' | 'running';
    data: unknown;
    startedAt: string;
    finishedAt?: string;
}

// Union type for all possible node results
export type NodeExecutionResult =
    | TriggerResult
    | HttpResult
    | EmailResult
    | ConditionResult
    | DelayResult
    | LoopResult
    | DatabaseResult
    | N8nResult
    | ExecutionOutput;

// =============================================================================
// Type Guards
// =============================================================================

export function isWorkflowNode(obj: unknown): obj is WorkflowNode {
    return workflowNodeSchema.safeParse(obj).success;
}

export function isWorkflowConnection(obj: unknown): obj is WorkflowConnection {
    return workflowConnectionSchema.safeParse(obj).success;
}

export function isWorkflowDefinition(obj: unknown): obj is WorkflowDefinition {
    return workflowDefinitionSchema.safeParse(obj).success;
}

// =============================================================================
// Inferred Types from Zod (single source of truth)
// =============================================================================

export type WorkflowNodeInput = z.infer<typeof workflowNodeSchema>;
export type WorkflowConnectionInput = z.infer<typeof workflowConnectionSchema>;
export type WorkflowDefinitionInput = z.infer<typeof workflowDefinitionSchema>;
