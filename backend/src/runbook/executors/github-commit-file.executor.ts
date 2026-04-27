import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  StepExecutor,
} from '../types/executor.types';

export interface GitHubCommitFileConfig {
  /** Repository as "owner/name", e.g. "Hvelizgr/NanoFlow". Supports templates. */
  repo: string;
  /** Target branch. Supports templates. Defaults to 'main' when omitted. */
  branch?: string;
  /** File path inside the repo, e.g. "config/flags.json". Supports templates. */
  path: string;
  /** File content as plain text (UTF-8). Supports templates. */
  content: string;
  /** Commit message. Supports templates. */
  message: string;
  /**
   * ConnectedAccount ID (provider='github') whose accessToken holds a
   * PAT or GitHub App installation token with `contents:write` scope.
   * Pre-resolved by SecretTemplateResolver into context.secrets[credentialId].
   */
  credentialId: string;
  /** Optional committer name override. Defaults to the token's user. */
  committerName?: string;
  /** Optional committer email override. Defaults to the token's user. */
  committerEmail?: string;
  /**
   * GitHub API base URL. Defaults to https://api.github.com. Override
   * for GitHub Enterprise Server (e.g. https://ghe.example.com/api/v3).
   */
  apiBaseUrl?: string;
  /**
   * When true, fail the step if the path does NOT already exist (i.e.
   * refuse to create new files). Defaults to false — the step will
   * create the file if it's missing, update it otherwise. Useful for
   * runbooks that should only edit existing config, never introduce
   * new files.
   */
  requireExisting?: boolean;
  /** Maximum time to wait for the GitHub API in ms (default: 30000). */
  timeout?: number;
}

export interface GitHubCommitFileOutput {
  /** SHA of the new commit produced by this step. */
  commitSha: string;
  /** SHA of the file content blob after the commit. */
  contentSha: string;
  /** Browser URL for the commit (https://github.com/owner/name/commit/<sha>). */
  htmlUrl: string;
  /** Branch the file was committed to. */
  branch: string;
  /** Path that was committed. */
  path: string;
  /** True if the step created the file; false if it updated an existing one. */
  created: boolean;
}

/**
 * GitHub Contents API "create or update file" executor.
 *
 * Uses the GitHub REST API (no git binary, no SSH) to commit a single
 * file directly to a branch. Authentication is read from a
 * ConnectedAccount of provider='github' via the pre-resolved secrets
 * map in ExecutorContext.
 *
 * Why a single-file API call instead of `git push`:
 *   - No local clone required (works in any runner: local, docker, fly)
 *   - No SSH key wrangling
 *   - Atomic at the file level — the commit either lands or doesn't
 *   - Same surface area as the GitHub web UI's "Edit file" button
 *
 * Limits inherited from the GitHub API:
 *   - File size cap of 1 MiB per call (Contents API limit)
 *   - One file per call. For multi-file commits, chain multiple steps
 *     or use the lower-level Git Data API in a future executor.
 *
 * Endpoint reference:
 *   PUT /repos/{owner}/{repo}/contents/{path}
 *   GET /repos/{owner}/{repo}/contents/{path}?ref={branch}
 *
 * The GET fetches the current blob SHA so the PUT can target it (the
 * Contents API requires `sha` for updates; passing it would 422 if the
 * file is new). On a 404 we treat the file as new.
 */
export class GitHubCommitFileExecutor implements StepExecutor<GitHubCommitFileConfig> {
  readonly type = 'github.commitFile';

  /** Override-able for tests. Real path uses globalThis.fetch. */
  private readonly httpFetch: typeof fetch;

  constructor(httpFetch: typeof fetch = fetch) {
    this.httpFetch = httpFetch;
  }

  async execute(config: GitHubCommitFileConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const timeoutMs = config.timeout ?? 30_000;

    const repo = resolveTemplate(config.repo ?? '', context);
    const branch = resolveTemplate(config.branch ?? 'main', context);
    const path = resolveTemplate(config.path ?? '', context);
    const content = resolveTemplate(config.content ?? '', context);
    const message = resolveTemplate(config.message ?? '', context);
    const apiBaseUrl = (config.apiBaseUrl ?? 'https://api.github.com').replace(/\/$/, '');

    if (!repo || !repo.includes('/')) {
      return {
        success: false,
        error: 'repo is required and must be in "owner/name" format',
        duration: Date.now() - startTime,
      };
    }
    if (!path) {
      return {
        success: false,
        error: 'path is required',
        duration: Date.now() - startTime,
      };
    }
    if (!message) {
      return {
        success: false,
        error: 'message (commit message) is required',
        duration: Date.now() - startTime,
      };
    }

    const token = context.secrets?.[config.credentialId];
    if (!token) {
      return {
        success: false,
        error: `GitHub token not found: credentialId "${config.credentialId}" is not in context.secrets. Add a ConnectedAccount with provider="github" and reference it in the step config.`,
        duration: Date.now() - startTime,
      };
    }

    const [owner, name] = repo.split('/', 2);
    const encodedPath = path
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    const contentsUrl = `${apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      name
    )}/contents/${encodedPath}`;

    context.emit?.({
      type: 'log',
      text: `github.commitFile → ${repo} ${branch}:${path}`,
      timestamp: new Date(),
    });

    if (context.dryRun) {
      context.emit?.({
        type: 'log',
        text: `[dry-run] would commit "${message}" to ${repo}@${branch}:${path} (${content.length} bytes)`,
        timestamp: new Date(),
      });
      return {
        success: true,
        output: {
          dryRun: true,
          repo,
          branch,
          path,
          bytes: content.length,
        },
        duration: Date.now() - startTime,
      };
    }

    const baseHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'operari/1.0',
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Step 1 — discover the current blob sha (404 means new file).
      let existingSha: string | undefined;
      const probe = await this.httpFetch(`${contentsUrl}?ref=${encodeURIComponent(branch)}`, {
        method: 'GET',
        headers: baseHeaders,
        signal: controller.signal,
      });

      if (probe.status === 200) {
        const probeJson = (await probe.json()) as { sha?: string };
        existingSha = probeJson.sha;
      } else if (probe.status !== 404) {
        clearTimeout(timer);
        const text = await probe.text();
        return {
          success: false,
          error: `GitHub probe failed: HTTP ${probe.status} ${probe.statusText} — ${text.slice(0, 300)}`,
          duration: Date.now() - startTime,
        };
      }

      if (config.requireExisting && !existingSha) {
        clearTimeout(timer);
        return {
          success: false,
          error: `requireExisting=true but ${repo}@${branch}:${path} does not exist. Refusing to create.`,
          duration: Date.now() - startTime,
        };
      }

      // Step 2 — PUT the new content.
      const body: Record<string, unknown> = {
        message,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch,
      };
      if (existingSha) {
        body.sha = existingSha;
      }
      if (config.committerName && config.committerEmail) {
        body.committer = {
          name: resolveTemplate(config.committerName, context),
          email: resolveTemplate(config.committerEmail, context),
        };
      }

      const put = await this.httpFetch(contentsUrl, {
        method: 'PUT',
        headers: { ...baseHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!put.ok) {
        const text = await put.text();
        return {
          success: false,
          error: `GitHub commit failed: HTTP ${put.status} ${put.statusText} — ${text.slice(0, 500)}`,
          duration: Date.now() - startTime,
        };
      }

      const result = (await put.json()) as {
        commit?: { sha?: string; html_url?: string };
        content?: { sha?: string };
      };

      const output: GitHubCommitFileOutput = {
        commitSha: result.commit?.sha ?? '',
        contentSha: result.content?.sha ?? '',
        htmlUrl: result.commit?.html_url ?? '',
        branch,
        path,
        created: !existingSha,
      };

      context.emit?.({
        type: 'log',
        text: `${output.created ? 'created' : 'updated'} ${repo}@${branch}:${path} → ${output.commitSha.slice(0, 7)}`,
        timestamp: new Date(),
      });

      return {
        success: true,
        output: output as unknown as Record<string, unknown>,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          success: false,
          error: `GitHub API timed out after ${timeoutMs}ms`,
          duration: Date.now() - startTime,
        };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - startTime,
      };
    }
  }
}
