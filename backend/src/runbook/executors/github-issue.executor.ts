import { ExecutorContext, resolveTemplate } from '../types/executor.types';
import { ApiRequest, ApiStepExecutor, splitList } from './_api-step';

export interface GitHubIssueConfig {
  action: 'create' | 'comment' | 'close';
  /** PAT or installation token with issues:write. Usually `{{secrets.<id>}}`. */
  token: string;
  owner: string;
  repo: string;
  title?: string;
  body?: string;
  labels?: string;
  issueNumber?: string;
}

/** GitHub REST — open a postmortem issue, comment on it or close it. */
export class GitHubIssueExecutor extends ApiStepExecutor<GitHubIssueConfig> {
  readonly type = 'github.issue';

  protected build(config: GitHubIssueConfig, context: ExecutorContext): ApiRequest | string {
    const r = (v?: string) => resolveTemplate(v ?? '', context);
    const token = r(config.token);
    const owner = r(config.owner);
    const repo = r(config.repo);
    if (!token) return 'token is required';
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return 'owner and repo are required';
    const base = `https://api.github.com/repos/${owner}/${repo}/issues`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'operari',
    };
    const action = config.action ?? 'create';

    if (action === 'create') {
      const title = r(config.title);
      if (!title) return 'title is required to create an issue';
      return {
        method: 'POST',
        url: base,
        headers,
        body: { title, body: r(config.body), labels: splitList(r(config.labels)) },
        describe: `GitHub create issue in ${owner}/${repo} — ${title.slice(0, 120)}`,
      };
    }

    const number = r(config.issueNumber).replace(/^#/, '');
    if (!/^\d+$/.test(number)) return `issueNumber is required to ${action}`;
    if (action === 'comment') {
      const body = r(config.body);
      if (!body) return 'body is required to comment';
      return {
        method: 'POST',
        url: `${base}/${number}/comments`,
        headers,
        body: { body },
        describe: `GitHub comment on ${owner}/${repo}#${number}`,
      };
    }
    return {
      method: 'PATCH',
      url: `${base}/${number}`,
      headers,
      body: { state: 'closed' },
      describe: `GitHub close ${owner}/${repo}#${number}`,
    };
  }

  protected shapeOutput(body: unknown, status: number) {
    const b = (body ?? {}) as { number?: number; html_url?: string; id?: number };
    return { status, number: b.number, id: b.id, url: b.html_url };
  }
}
