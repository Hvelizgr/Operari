import { ExecutorContext, resolveTemplate } from '../types/executor.types';
import { ApiRequest, ApiStepExecutor, splitList } from './_api-step';

export interface DatadogEventConfig {
  /** Datadog API key. Usually `{{secrets.<id>}}`. */
  apiKey: string;
  /** datadoghq.com, datadoghq.eu, us3.datadoghq.com, ... */
  site?: string;
  title: string;
  text?: string;
  alertType?: 'info' | 'success' | 'warning' | 'error';
  /** Comma-separated, e.g. "service:checkout,env:prod". */
  tags?: string;
}

/**
 * Datadog Events API — drops a marker on the event stream so the
 * remediation shows up next to the graphs that triggered it.
 */
export class DatadogEventExecutor extends ApiStepExecutor<DatadogEventConfig> {
  readonly type = 'datadog.event';

  protected build(config: DatadogEventConfig, context: ExecutorContext): ApiRequest | string {
    const r = (v?: string) => resolveTemplate(v ?? '', context);
    const apiKey = r(config.apiKey);
    const title = r(config.title);
    if (!apiKey) return 'apiKey is required';
    if (!title) return 'title is required';
    const site = (r(config.site) || 'datadoghq.com')
      .replace(/^https?:\/\//, '')
      .replace(/^api\./, '');
    if (!/^[a-z0-9.-]+$/i.test(site)) return `invalid Datadog site "${site}"`;
    return {
      method: 'POST',
      url: `https://api.${site}/api/v1/events`,
      headers: { 'DD-API-KEY': apiKey },
      body: {
        title: title.slice(0, 100),
        text: r(config.text) || title,
        alert_type: config.alertType ?? 'info',
        tags: ['source:operari', ...splitList(r(config.tags))],
      },
      describe: `Datadog event on ${site} — ${title.slice(0, 120)}`,
    };
  }

  protected shapeOutput(body: unknown, status: number) {
    const b = (body ?? {}) as { event?: { id?: number; url?: string } };
    return { status, eventId: b.event?.id, url: b.event?.url };
  }
}
