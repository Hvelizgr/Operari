import { ExecutorContext, resolveTemplate } from '../types/executor.types';
import { ApiRequest, ApiStepExecutor, splitList } from './_api-step';

export interface JiraConfig {
  action: 'create' | 'comment' | 'transition';
  /** e.g. https://acme.atlassian.net */
  baseUrl: string;
  email: string;
  /** Atlassian API token. Usually `{{secrets.<id>}}`. */
  apiToken: string;
  projectKey?: string;
  issueType?: string;
  summary?: string;
  description?: string;
  labels?: string;
  /** Existing issue for comment / transition, e.g. OPS-123. */
  issueKey?: string;
  comment?: string;
  /** Transition id (see GET /rest/api/2/issue/{key}/transitions). */
  transitionId?: string;
}

/**
 * Jira Cloud / Server REST v2 — open an incident ticket, comment on it
 * or move it through the workflow. v2 takes plain-text bodies, which
 * keeps templated descriptions readable without building ADF.
 */
export class JiraExecutor extends ApiStepExecutor<JiraConfig> {
  readonly type = 'jira.issue';

  protected build(config: JiraConfig, context: ExecutorContext): ApiRequest | string {
    const r = (v?: string) => resolveTemplate(v ?? '', context);
    const baseUrl = r(config.baseUrl).replace(/\/+$/, '');
    const email = r(config.email);
    const token = r(config.apiToken);
    if (!baseUrl || !email || !token) return 'baseUrl, email and apiToken are required';
    const headers = {
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
    };
    const action = config.action ?? 'create';
    const issueKey = r(config.issueKey);

    if (action === 'comment' || action === 'transition') {
      if (!issueKey) return `issueKey is required to ${action}`;
      if (action === 'comment') {
        const comment = r(config.comment);
        if (!comment) return 'comment is required';
        return {
          method: 'POST',
          url: `${baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`,
          headers,
          body: { body: comment },
          describe: `Jira comment on ${issueKey}`,
        };
      }
      const transitionId = r(config.transitionId);
      if (!transitionId) return 'transitionId is required';
      return {
        method: 'POST',
        url: `${baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/transitions`,
        headers,
        body: { transition: { id: transitionId } },
        describe: `Jira transition ${issueKey} → ${transitionId}`,
      };
    }

    const projectKey = r(config.projectKey);
    const summary = r(config.summary);
    if (!projectKey || !summary) return 'projectKey and summary are required to create an issue';
    return {
      method: 'POST',
      url: `${baseUrl}/rest/api/2/issue`,
      headers,
      body: {
        fields: {
          project: { key: projectKey },
          issuetype: { name: r(config.issueType) || 'Task' },
          summary,
          description: r(config.description),
          labels: splitList(r(config.labels)),
        },
      },
      describe: `Jira create ${projectKey} issue — ${summary.slice(0, 120)}`,
    };
  }

  protected shapeOutput(body: unknown, status: number) {
    const b = (body ?? {}) as { id?: string; key?: string; self?: string };
    return { status, id: b.id, key: b.key, url: b.self };
  }
}
