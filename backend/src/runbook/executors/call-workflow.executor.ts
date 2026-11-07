import { guardedFetch } from '../../security/ssrf-guard';
import { WorkflowCallbackService } from '../services/workflow-callback.service';
import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  StepExecutor,
} from '../types/executor.types';

export interface CallWorkflowConfig {
  url: string;
  /** JSON object. `callbackUrl` is added to it. */
  body?: string | Record<string, unknown>;
  headers?: string | Record<string, string>;
  /** How long to wait for the answer. Default one hour, at most seven days. */
  timeoutSeconds?: number;
}

const CALL_TIMEOUT_MS = 30_000;
const DEFAULT_WAIT_SECONDS = 3600;
const MIN_WAIT_SECONDS = 60;
const MAX_WAIT_SECONDS = 7 * 24 * 3600;

function jsonObject(value: unknown, field: string): Record<string, unknown> {
  const parsed = typeof value === 'string' ? (value.trim() ? JSON.parse(value) : {}) : (value ?? {});
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${field} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function waitSeconds(value: unknown): number {
  const n = Number(value);
  const seconds = Number.isFinite(n) && n > 0 ? n : DEFAULT_WAIT_SECONDS;
  return Math.min(Math.max(seconds, MIN_WAIT_SECONDS), MAX_WAIT_SECONDS);
}

/**
 * Starts a workflow elsewhere (n8n, Zapier, any webhook) and pauses the run,
 * holding nothing, until it POSTs to the `callbackUrl` it received. For a call
 * that answers right away, the HTTP step is enough.
 */
export class CallWorkflowExecutor implements StepExecutor<CallWorkflowConfig> {
  readonly type = 'operari.callWorkflow';

  constructor(
    private readonly getCallbacks: () => WorkflowCallbackService,
    private readonly httpFetch: typeof fetch = fetch
  ) {}

  async execute(config: CallWorkflowConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const fail = (error: string): ExecutorResult => ({
      success: false,
      error,
      duration: Date.now() - startTime,
    });

    const url = resolveTemplate(config.url ?? '', context);
    if (!url) return fail('url is required');

    let body: Record<string, unknown>;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const rawBody =
        typeof config.body === 'string'
          ? resolveTemplate(config.body, context)
          : JSON.parse(resolveTemplate(JSON.stringify(config.body ?? {}), context));
      body = jsonObject(rawBody, 'body');
      for (const [key, value] of Object.entries(jsonObject(config.headers, 'headers'))) {
        headers[key] = resolveTemplate(String(value), context);
      }
    } catch (err) {
      return fail((err as Error).message);
    }

    if (context.dryRun) {
      const host = URL.canParse(url) ? new URL(url).host : 'invalid url';
      context.emit?.({
        type: 'log',
        text: `[dry-run] would call a workflow at ${host} and wait for its answer`,
        timestamp: new Date(),
      });
      return { success: true, output: { dryRun: true }, duration: Date.now() - startTime };
    }

    const seconds = waitSeconds(config.timeoutSeconds);
    const callbacks = this.getCallbacks();
    const callback = await callbacks.issue({
      tenantId: context.tenantId,
      executionId: context.runId,
      stepId: context.stepId,
      expiresAt: new Date(startTime + seconds * 1000),
    });

    const failCall = async (error: string) => {
      await callbacks.revoke(callback.id);
      return fail(error);
    };
    try {
      const response = await guardedFetch(this.httpFetch, url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, callbackUrl: callback.url }),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      if (!response.ok) return await failCall(`The workflow answered HTTP ${response.status}`);
    } catch (err) {
      return await failCall(`Could not call the workflow: ${(err as Error).message}`);
    }

    context.emit?.({
      type: 'log',
      text: `Workflow started; waiting up to ${seconds}s for its answer`,
      timestamp: new Date(),
    });
    return {
      success: true,
      paused: true,
      output: { status: 'WAITING', timeoutSeconds: seconds },
      duration: Date.now() - startTime,
    };
  }
}
