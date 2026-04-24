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

/**
 * Database step config — runbook scope.
 *
 * The legacy NanoFlow database node accepted any of select/insert/
 * update/delete (i.e. arbitrary DML against user data). NanoRun
 * narrows this to operations a runbook author legitimately needs:
 *
 *   - "migrate"   — apply a versioned schema migration (DDL)
 *   - "health"    — read-only sanity probe (e.g. SELECT 1, count())
 *   - "backup"    — issue a snapshot/backup command
 *
 * Anything else is rejected at the executor level. The narrower set
 * means the only way for a runbook to mutate user rows is through a
 * shell step that explicitly calls the right migration tool.
 */
export interface DatabaseNodeConfig {
  operation?: 'migrate' | 'health' | 'backup';
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

export interface SwitchNodeConfig {
  field?: string;
  cases?: Array<{ value: string; label?: string }>;
}

export interface SwitchResult extends ExecutionOutput {
  switchValue: unknown;
  matchedCase: number;
  matchedLabel: string | null;
}

export interface DecisionNodeConfig {
  expression?: string; // Jexl expression
}

export interface SplitNodeConfig {
  itemsPath?: string; // Path to array in input
}

export interface JoinNodeConfig {
  mode?: 'wait_all' | 'first_wins';
}

export interface ShellCommandNodeConfig {
  command?: string;
}

export interface StoreSetNodeConfig {
  bucketName?: string;
  key?: string;
  value?: unknown;
}

export interface StoreGetNodeConfig {
  bucketName?: string;
  key?: string;
}

export interface SuspendNodeConfig {
  // No config needed for now
}

export interface SetMetadataNodeConfig {
  metadata?: Record<string, unknown>;
}

export interface CreateTicketNodeConfig {
  webhookUrl?: string;
  subject?: string;
  body?: string;
}

export interface RepeatNodeConfig {
  count?: number; // Number of times to repeat (default: 1)
  parallel?: boolean; // Execute iterations in parallel (default: true)
}

export interface MultiplexNodeConfig {
  targets?: string[]; // Array of target identifiers
  stagger?: number; // Delay in ms between each target execution (default: 0)
  continueThreshold?: number; // Percentage of successful executions required to continue (default: 100)
}

export interface LimitNodeConfig {
  limitType?: 'time' | 'memory' | 'cpu' | 'concurrent' | 'queue' | 'daily'; // Type of limit
  amount?: number; // Limit value (seconds for time, MB for memory, % for CPU, count for concurrent/queue/daily)
  duration?: number; // Sustain period in seconds for CPU/memory limits
  enabled?: boolean; // Whether the limit is active
  onExceed?: 'abort' | 'warn' | 'skip'; // Action when limit is exceeded
  notifyEmail?: string; // Email to notify when limit is exceeded
  notifyWebhook?: string; // Webhook to call when limit is exceeded
}

export interface ActionNodeConfig {
  actionType?: 'email' | 'webhook' | 'disable' | 'delete' | 'tag' | 'run_event' | 'channel'; // Type of post-job action
  condition?: 'success' | 'error' | 'complete' | 'warning'; // When to trigger the action
  enabled?: boolean; // Whether the action is active
  // Email action config
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  emailTemplate?: string;
  // Webhook action config
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT';
  webhookHeaders?: Record<string, string>;
  webhookBody?: string;
  // Tag action config
  tags?: string[];
  // Run event action config
  eventId?: string;
  eventInput?: Record<string, unknown>;
  // Channel action config (combines multiple notification targets)
  channelTargets?: string[];
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
  | SwitchNodeConfig
  | DecisionNodeConfig
  | SplitNodeConfig
  | JoinNodeConfig
  | ShellCommandNodeConfig
  | StoreSetNodeConfig
  | StoreGetNodeConfig
  | SuspendNodeConfig
  | SetMetadataNodeConfig
  | CreateTicketNodeConfig
  | RepeatNodeConfig
  | MultiplexNodeConfig
  | LimitNodeConfig
  | ActionNodeConfig
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
  | 'Decision'
  | 'Split'
  | 'Join'
  | 'ShellCommand'
  | 'StoreSet'
  | 'StoreGet'
  | 'Suspend'
  | 'SetMetadata'
  | 'CreateTicket'
  | 'Repeat'
  | 'Multiplex'
  | 'Limit'
  | 'Action'
  | string; // Allow custom types

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  title: string;
  position: NodePosition;
  enabled?: boolean;
  config?: NodeConfig;
  inputs?: NodePort[];
  outputs?: NodePort[];
}

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  position: nodePositionSchema,
  enabled: z.boolean().optional(),
  config: nodeConfigSchema,
  inputs: z.array(nodePortSchema).optional(),
  outputs: z.array(nodePortSchema).optional(),
});

// =============================================================================
// Workflow Connection
// =============================================================================

export interface WorkflowConnection {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
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
// Runbook input declarations (Rundeck-style job options)
// =============================================================================

export type RunbookInputType = 'text' | 'number' | 'boolean' | 'select';

export interface RunbookInputDefinition {
  name: string;
  type: RunbookInputType;
  label?: string;
  description?: string;
  required?: boolean;
  default?: string | number | boolean;
  options?: string[];
}

export const runbookInputDefinitionSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'name must be a valid identifier'),
    type: z.enum(['text', 'number', 'boolean', 'select']),
    label: z.string().optional(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    default: z.union([z.string(), z.number(), z.boolean()]).optional(),
    options: z.array(z.string()).optional(),
  })
  .refine(v => v.type !== 'select' || (v.options && v.options.length > 0), {
    message: 'select inputs require at least one option',
    path: ['options'],
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
  inputs?: RunbookInputDefinition[];
}

export const workflowDefinitionSchema = z.object({
  name: z.string().min(1).optional().default('Untitled Workflow'),
  description: z.string().optional(),
  nodes: z.array(workflowNodeSchema),
  connections: z.array(workflowConnectionSchema),
  isActive: z.boolean().optional(),
  schedule: z.string().optional(),
  /**
   * Optional id of a runbook to dispatch when this runbook's run
   * fails. The engine validates (same tenant, not self, not null
   * chain) at execute time, so we accept any valid UUID here and
   * let the dispatch-site catch bogus ids.
   */
  onErrorRunbookId: z.string().uuid().nullish(),
  inputs: z.array(runbookInputDefinitionSchema).optional(),
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

export interface DecisionResult extends ExecutionOutput {
  decisionResult: boolean;
  decisionValue: unknown;
}

export interface SplitResult extends ExecutionOutput {
  splitItems: unknown[];
  splitCount: number;
  isSplit: boolean;
}

export interface JoinResult extends ExecutionOutput {
  isJoined: boolean;
  joinedAt: string;
}

export interface ShellCommandResult extends ExecutionOutput {
  stdout?: string;
  stderr?: string;
}

export interface StoreResult extends ExecutionOutput {
  success: boolean;
  key?: string;
  value?: unknown;
}

export interface SuspendResult extends ExecutionOutput {
  isSuspended: true;
}

export interface SetMetadataResult extends ExecutionOutput {
  success: boolean;
  metadata: Record<string, unknown>;
}

export interface CreateTicketResult extends ExecutionOutput {
  success: boolean;
  response: unknown;
  webhookUrl: string;
}

export interface RepeatResult extends ExecutionOutput {
  isRepeat: boolean;
  repeatCount: number;
  currentIteration: number;
}

export interface MultiplexResult extends ExecutionOutput {
  isMultiplex: boolean;
  targets: string[];
  targetCount: number;
  stagger: number;
}

export interface LimitResult extends ExecutionOutput {
  isLimit: boolean;
  limitType: string;
  amount: number;
  exceeded: boolean;
  action: string;
}

export interface ActionResult extends ExecutionOutput {
  isAction: boolean;
  actionType: string;
  condition: string;
  executed: boolean;
  result?: unknown;
}

// Union type for all possible node results
export type NodeExecutionResult =
  | TriggerResult
  | HttpResult
  | EmailResult
  | ConditionResult
  | DelayResult
  | LoopResult
  | SwitchResult
  | DatabaseResult
  | DecisionResult
  | SplitResult
  | JoinResult
  | ShellCommandResult
  | StoreResult
  | SuspendResult
  | SetMetadataResult
  | CreateTicketResult
  | RepeatResult
  | MultiplexResult
  | LimitResult
  | ActionResult
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
