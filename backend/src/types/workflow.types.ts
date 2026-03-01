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
  workflowId?: string; // ID del workflow de n8n a ejecutar
  workflowName?: string; // Nombre para mostrar
  waitForCompletion?: boolean; // Esperar a que termine la ejecución
  timeout?: number; // Timeout en ms
  inputMapping?: Record<string, string>; // Mapeo de inputs
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
  value?: any;
}

export interface StoreGetNodeConfig {
  bucketName?: string;
  key?: string;
}

export type SuspendNodeConfig = Record<string, never>;

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

export interface SwitchNodeConfig {
  expression?: string;
}

export interface WebScraperNodeConfig {
  url?: string;
  mode?: 'fast' | 'advanced'; // fast: Cheerio, advanced: Jina AI / Markdown
  selector?: string;
  extractText?: boolean;
  extractHtml?: boolean;
  extractLinks?: boolean;
  extractImages?: boolean;
}

// AI & Integration Node Configs
export interface LLMNodeConfig {
  provider?: string;
  model?: string;
  prompt?: string;
  systemPrompt?: string;
  inputField?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface SlackNodeConfig {
  message?: string;
  channel?: string;
  webhookUrl?: string;
}

export interface TelegramNodeConfig {
  operation?: 'sendMessage' | 'sendPhoto' | 'sendDocument';
  chatId?: string;
  message?: string;
  parseMode?: 'HTML' | 'Markdown';
}

export interface BinaryNodeConfig {
  operation?: 'read' | 'write';
  filePath?: string;
  encoding?: string;
  content?: string;
}

export interface CryptoNodeConfig {
  operation?: 'hash' | 'sign' | 'random';
  algorithm?: string;
  inputField?: string;
  key?: string;
  encoding?: string;
}

export interface DateTimeNodeConfig {
  operation?: 'now' | 'format' | 'add' | 'subtract' | 'diff' | 'parse';
  inputField?: string;
  format?: string;
  amount?: number;
  unit?: string;
}

export interface DocumentParserNodeConfig {
  inputField?: string;
  parser?: string;
}

export interface EmbeddingsNodeConfig {
  provider?: string;
  model?: string;
  inputField?: string;
  dimensions?: number;
}

export interface HtmlExtractNodeConfig {
  inputField?: string;
  sourceData?: string;
  selector?: string;
  extractType?: 'text' | 'html' | 'attribute';
  attribute?: string;
  multiple?: boolean;
}

export interface MemoryNodeConfig {
  operation?: 'get' | 'set' | 'delete' | 'list';
  namespace?: string;
  key?: string;
  value?: unknown;
}

export interface PerplexityNodeConfig {
  model?: string;
  query?: string;
  inputField?: string;
}

export interface SpreadsheetNodeConfig {
  operation?: 'read' | 'write' | 'append';
  filePath?: string;
  headers?: boolean;
  data?: unknown[][];
}

export interface TextSplitterNodeConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  inputField?: string;
}

export interface VectorStoreNodeConfig {
  operation?: 'upsert' | 'query' | 'delete';
  provider?: string;
  collection?: string;
  queryVector?: number[];
  topK?: number;
  ids?: string[];
}

export interface CompareDatasetsNodeConfig {
  inputField1?: string;
  inputField2?: string;
  compareFields?: string[];
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
  | SwitchNodeConfig
  | WebScraperNodeConfig
  | LLMNodeConfig
  | SlackNodeConfig
  | TelegramNodeConfig
  | BinaryNodeConfig
  | CryptoNodeConfig
  | DateTimeNodeConfig
  | DocumentParserNodeConfig
  | EmbeddingsNodeConfig
  | HtmlExtractNodeConfig
  | MemoryNodeConfig
  | PerplexityNodeConfig
  | SpreadsheetNodeConfig
  | TextSplitterNodeConfig
  | VectorStoreNodeConfig
  | CompareDatasetsNodeConfig
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

export interface WorkflowNodeTest {
  id: string;
  name: string;
  condition: string; // Jexl expression
  severity: 'error' | 'warning';
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  title: string;
  position: NodePosition;
  enabled?: boolean;
  breakpoint?: boolean;
  config?: NodeConfig;
  inputs?: NodePort[];
  outputs?: NodePort[];
  tests?: WorkflowNodeTest[];
  mockOutput?: ExecutionOutput;
  retryOptions?: {
    enabled: boolean;
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  };
}

export const workflowNodeTestSchema = z.object({
  id: z.string(),
  name: z.string(),
  condition: z.string(),
  severity: z.enum(['error', 'warning']),
});

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  position: nodePositionSchema,
  enabled: z.boolean().optional(),
  breakpoint: z.boolean().optional(),
  config: nodeConfigSchema,
  inputs: z.array(nodePortSchema).optional(),
  outputs: z.array(nodePortSchema).optional(),
  tests: z.array(workflowNodeTestSchema).optional(),
  mockOutput: z.record(z.string(), z.unknown()).optional(),
  retryOptions: z.object({
    enabled: z.boolean(),
    maxRetries: z.number().int().min(0).optional(),
    initialDelay: z.number().int().min(0).optional(),
    maxDelay: z.number().int().min(0).optional(),
    backoffFactor: z.number().min(1).optional(),
  }).optional(),
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
  __activePorts?: number[]; // For routing support (Switch node, etc.)
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
  value?: any;
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

export interface SwitchResult extends ExecutionOutput {
  isSwitch: true;
  result: boolean;
  expression: string;
}

export interface WebScraperResult extends ExecutionOutput {
  url: string;
  mode: string;
  title?: string;
  text?: string;
  html?: string;
  markdown?: string;
  links?: string[];
  images?: string[];
  metadata?: Record<string, any>;
}

// AI & Integration Node Results
export interface LLMResult extends ExecutionOutput {
  response?: string;
  model?: string;
}

export interface SlackResult extends ExecutionOutput {
  success: boolean;
  response?: unknown;
  channel?: string;
}

export interface TelegramResult extends ExecutionOutput {
  success: boolean;
  response?: unknown;
  chatId?: string;
}

export interface BinaryResult extends ExecutionOutput {
  read?: boolean;
  written?: boolean;
  filePath?: string;
  size?: number;
  data?: string;
}

export interface CryptoResult extends ExecutionOutput {
  result?: string;
  algorithm?: string;
  encoding?: string;
}

export interface DateTimeResult extends ExecutionOutput {
  result?: string | number;
  formatted?: string;
  timestamp?: number;
}

export interface DocumentParserResult extends ExecutionOutput {
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingsResult extends ExecutionOutput {
  embeddings?: number[][];
  model?: string;
  dimensions?: number;
}

export interface HtmlExtractResult extends ExecutionOutput {
  extracted?: string | string[];
  count?: number;
}

export interface MemoryResult extends ExecutionOutput {
  success: boolean;
  key?: string;
  value?: unknown;
  keys?: string[];
}

export interface PerplexityResult extends ExecutionOutput {
  response?: string;
  citations?: string[];
  model?: string;
}

export interface SpreadsheetResult extends ExecutionOutput {
  data?: unknown[][];
  rows?: number;
  columns?: number;
  success?: boolean;
}

export interface TextSplitterResult extends ExecutionOutput {
  chunks?: string[];
  count?: number;
}

export interface VectorStoreResult extends ExecutionOutput {
  success?: boolean;
  count?: number;
  ids?: string[];
  matches?: Array<{
    id: string;
    score: number;
    text?: string;
    metadata?: Record<string, unknown>;
  }>;
  sources?: Array<{
    index: number;
    id: string;
    text?: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
}

export interface CompareDatasetsResult extends ExecutionOutput {
  matches?: unknown[];
  differences?: unknown[];
  merged?: unknown[];
  count?: number;
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
  | SwitchResult
  | WebScraperResult
  | LLMResult
  | SlackResult
  | TelegramResult
  | BinaryResult
  | CryptoResult
  | DateTimeResult
  | DocumentParserResult
  | EmbeddingsResult
  | HtmlExtractResult
  | MemoryResult
  | PerplexityResult
  | SpreadsheetResult
  | TextSplitterResult
  | VectorStoreResult
  | CompareDatasetsResult
  | ExecutionOutput;

// =============================================================================
// Workflow Type (for tests and services)
// =============================================================================

export interface WorkflowConnectionAlt {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePort?: string;
  targetPort?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnectionAlt[];
  isActive?: boolean;
  schedule?: string;
}

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
