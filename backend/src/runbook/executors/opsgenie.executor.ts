import { ExecutorContext, resolveTemplate } from '../types/executor.types';
import { ApiRequest, ApiStepExecutor, splitList } from './_api-step';

export interface OpsgenieConfig {
  action: 'create' | 'close';
  /** Opsgenie API integration key. Usually `{{secrets.<id>}}`. */
  apiKey: string;
  region?: 'us' | 'eu';
  message?: string;
  /** Stable identifier; required to close, used to dedupe on create. */
  alias?: string;
  description?: string;
  priority?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  /** Comma-separated tags. */
  tags?: string;
}

/** Opsgenie Alert API — create an alert or close one by alias. */
export class OpsgenieExecutor extends ApiStepExecutor<OpsgenieConfig> {
  readonly type = 'opsgenie.alert';

  protected build(config: OpsgenieConfig, context: ExecutorContext): ApiRequest | string {
    const r = (v?: string) => resolveTemplate(v ?? '', context);
    const action = config.action ?? 'create';
    const apiKey = r(config.apiKey);
    const alias = r(config.alias);
    if (!apiKey) return 'apiKey is required';
    const base =
      config.region === 'eu' ? 'https://api.eu.opsgenie.com' : 'https://api.opsgenie.com';
    const headers = { Authorization: `GenieKey ${apiKey}` };

    if (action === 'close') {
      if (!alias) return 'alias is required to close an alert';
      return {
        method: 'POST',
        url: `${base}/v2/alerts/${encodeURIComponent(alias)}/close?identifierType=alias`,
        headers,
        body: { source: 'operari', note: `Closed by run ${context.runId}` },
        describe: `Opsgenie close alert ${alias}`,
      };
    }

    const message = r(config.message);
    if (!message) return 'message is required to create an alert';
    return {
      method: 'POST',
      url: `${base}/v2/alerts`,
      headers,
      body: {
        message: message.slice(0, 130),
        ...(alias ? { alias } : {}),
        ...(config.description ? { description: r(config.description) } : {}),
        priority: config.priority ?? 'P3',
        tags: splitList(r(config.tags)),
        source: 'operari',
      },
      describe: `Opsgenie create ${config.priority ?? 'P3'} alert — ${message.slice(0, 120)}`,
    };
  }

  protected shapeOutput(body: unknown, status: number) {
    const b = (body ?? {}) as { requestId?: string; result?: string };
    return { status, requestId: b.requestId, result: b.result };
  }
}
