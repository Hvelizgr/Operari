import { ExecutorContext, resolveTemplate } from '../types/executor.types';
import { ApiRequest, ApiStepExecutor } from './_api-step';

export interface PagerDutyConfig {
  action: 'trigger' | 'acknowledge' | 'resolve';
  /** Events API v2 integration (routing) key. Usually `{{secrets.<id>}}`. */
  routingKey: string;
  summary?: string;
  source?: string;
  severity?: 'critical' | 'error' | 'warning' | 'info';
  /** Required to acknowledge/resolve; optional on trigger to dedupe. */
  dedupKey?: string;
}

/** PagerDuty Events API v2 — open, acknowledge or resolve an incident. */
export class PagerDutyExecutor extends ApiStepExecutor<PagerDutyConfig> {
  readonly type = 'pagerduty.event';

  protected build(config: PagerDutyConfig, context: ExecutorContext): ApiRequest | string {
    const r = (v?: string) => resolveTemplate(v ?? '', context);
    const action = config.action ?? 'trigger';
    const routingKey = r(config.routingKey);
    const dedupKey = r(config.dedupKey);
    if (!routingKey) return 'routingKey is required';
    if (action !== 'trigger' && !dedupKey) return `dedupKey is required to ${action}`;
    const summary = r(config.summary);
    if (action === 'trigger' && !summary) return 'summary is required to trigger';

    return {
      method: 'POST',
      url: 'https://events.pagerduty.com/v2/enqueue',
      describe: `PagerDuty ${action}${dedupKey ? ` ${dedupKey}` : ''}${summary ? ` — ${summary.slice(0, 120)}` : ''}`,
      body: {
        routing_key: routingKey,
        event_action: action,
        ...(dedupKey ? { dedup_key: dedupKey } : {}),
        ...(action === 'trigger'
          ? {
              payload: {
                summary,
                source: r(config.source) || 'operari',
                severity: config.severity ?? 'error',
                custom_details: { runId: context.runId, stepId: context.stepId },
              },
            }
          : {}),
      },
    };
  }

  protected shapeOutput(body: unknown, status: number) {
    const b = (body ?? {}) as { dedup_key?: string; status?: string; message?: string };
    return { status, dedupKey: b.dedup_key, result: b.status, message: b.message };
  }
}
