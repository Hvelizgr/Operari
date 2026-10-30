import { ExecutorContext, resolveTemplate } from '../types/executor.types';
import { ApiRequest, ApiStepExecutor, splitList } from './_api-step';

export interface GrafanaAnnotationConfig {
  /** e.g. https://grafana.acme.com */
  baseUrl: string;
  /** Service account token. Usually `{{secrets.<id>}}`. */
  apiToken: string;
  text: string;
  tags?: string;
  /** Pin the annotation to one dashboard; omit for an org-wide one. */
  dashboardUid?: string;
}

/** Grafana HTTP API — annotate dashboards with what the runbook did. */
export class GrafanaAnnotationExecutor extends ApiStepExecutor<GrafanaAnnotationConfig> {
  readonly type = 'grafana.annotation';

  protected build(config: GrafanaAnnotationConfig, context: ExecutorContext): ApiRequest | string {
    const r = (v?: string) => resolveTemplate(v ?? '', context);
    const baseUrl = r(config.baseUrl).replace(/\/+$/, '');
    const token = r(config.apiToken);
    const text = r(config.text);
    if (!baseUrl || !token) return 'baseUrl and apiToken are required';
    if (!text) return 'text is required';
    const dashboardUID = r(config.dashboardUid);
    return {
      method: 'POST',
      url: `${baseUrl}/api/annotations`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        time: Date.now(),
        text,
        tags: ['operari', ...splitList(r(config.tags))],
        ...(dashboardUID ? { dashboardUID } : {}),
      },
      describe: `Grafana annotation — ${text.slice(0, 120)}`,
    };
  }

  protected shapeOutput(body: unknown, status: number) {
    const b = (body ?? {}) as { id?: number };
    return { status, annotationId: b.id };
  }
}
