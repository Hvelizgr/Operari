/**
 * @cairn/shared
 * Shared types and utilities between frontend and backend
 */

// Re-export all types
export * from './types';

// For backwards compatibility, also export main types directly
export type {
  WorkflowNode,
  Connection,
  ConnectionCondition,
  WorkflowDefinition,
  Position,
  ExecutionState,
} from './types/workflow';

export type {
  NodePort,
  NodeConfig,
  NodeCategory,
  NodeTypeDefinition,
  HttpNodeConfig,
  EmailNodeConfig,
  TransformNodeConfig,
  ConditionNodeConfig,
  DatabaseNodeConfig,
  DelayNodeConfig,
  LoopNodeConfig,
  WebhookNodeConfig,
  ScheduleNodeConfig,
} from './types/node';

export type {
  ExecutionStatus,
  ExecutionMetric,
  ExecutionResult,
  ExecutionContext,
  ExecutionInput,
  ExecutionOutput,
  NodeLogEntry,
} from './types/execution';
