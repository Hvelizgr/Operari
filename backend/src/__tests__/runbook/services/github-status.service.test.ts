import { GitHubStatusService } from '../../../runbook/services/github-status.service';
import { identityGitHubTokenDecryptor } from '../../../security/github-token-resolver';

// ---------------------------------------------------------------------------
// Fake Prisma
// ---------------------------------------------------------------------------

function fakePrisma(token: string | null = 'ghp_test-token') {
  return {
    connectedAccount: {
      findFirst: async () => (token ? { id: 'fake-account-id', accessToken: token } : null),
    },
    execution: {
      findUnique: async () => null,
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Fake fetch
// ---------------------------------------------------------------------------

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

function captureFetch(status = 201): { fetch: typeof fetch; captured: CapturedRequest[] } {
  const captured: CapturedRequest[] = [];
  const mockFetch = async (url: any, init: any) => {
    captured.push({ url: url as string, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => '{}',
    } as Response;
  };
  return { fetch: mockFetch as typeof fetch, captured };
}

describe('GitHubStatusService', () => {
  describe('postStatus', () => {
    it('posts a commit status to the correct GitHub API URL', async () => {
      const { fetch: mockFetch, captured } = captureFetch();
      const svc = new GitHubStatusService(fakePrisma(), mockFetch, identityGitHubTokenDecryptor);

      const result = await svc.postStatus('tenant-1', {
        owner: 'acme',
        repo: 'api',
        sha: 'abc123',
        state: 'success',
        description: 'All checks passed',
      });

      expect(result).toBe(true);
      expect(captured).toHaveLength(1);
      expect(captured[0].url).toBe('https://api.github.com/repos/acme/api/statuses/abc123');
    });

    it('sends correct headers including Bearer token', async () => {
      const { fetch: mockFetch, captured } = captureFetch();
      const svc = new GitHubStatusService(
        fakePrisma('ghp_my-token'),
        mockFetch,
        identityGitHubTokenDecryptor
      );

      await svc.postStatus('tenant-1', {
        owner: 'acme',
        repo: 'api',
        sha: 'abc123',
        state: 'pending',
        description: 'Running...',
      });

      const headers = captured[0].init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer ghp_my-token');
      expect(headers['Accept']).toBe('application/vnd.github+json');
      expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    });

    it('sends the correct body payload', async () => {
      const { fetch: mockFetch, captured } = captureFetch();
      const svc = new GitHubStatusService(fakePrisma(), mockFetch, identityGitHubTokenDecryptor);

      await svc.postStatus('tenant-1', {
        owner: 'acme',
        repo: 'api',
        sha: 'abc123',
        state: 'failure',
        description: 'Step "deploy" failed',
        targetUrl: 'https://app.nanorun.dev/runs/run-1',
        context: 'nanorun/deploy-prod',
      });

      const body = JSON.parse(captured[0].init.body as string);
      expect(body.state).toBe('failure');
      expect(body.description).toBe('Step "deploy" failed');
      expect(body.target_url).toBe('https://app.nanorun.dev/runs/run-1');
      expect(body.context).toBe('nanorun/deploy-prod');
    });

    it('defaults context to "nanorun" when not provided', async () => {
      const { fetch: mockFetch, captured } = captureFetch();
      const svc = new GitHubStatusService(fakePrisma(), mockFetch, identityGitHubTokenDecryptor);

      await svc.postStatus('tenant-1', {
        owner: 'acme',
        repo: 'api',
        sha: 'abc',
        state: 'success',
        description: 'ok',
      });

      const body = JSON.parse(captured[0].init.body as string);
      expect(body.context).toBe('nanorun');
    });

    it('returns false when no GitHub token is found', async () => {
      const { fetch: mockFetch, captured } = captureFetch();
      const svc = new GitHubStatusService(
        fakePrisma(null),
        mockFetch,
        identityGitHubTokenDecryptor
      );

      const result = await svc.postStatus('tenant-1', {
        owner: 'acme',
        repo: 'api',
        sha: 'abc',
        state: 'success',
        description: 'ok',
      });

      expect(result).toBe(false);
      expect(captured).toHaveLength(0);
    });

    it('returns false on non-2xx response', async () => {
      const { fetch: mockFetch } = captureFetch(403);
      const svc = new GitHubStatusService(fakePrisma(), mockFetch, identityGitHubTokenDecryptor);

      const result = await svc.postStatus('tenant-1', {
        owner: 'acme',
        repo: 'api',
        sha: 'abc',
        state: 'success',
        description: 'ok',
      });

      expect(result).toBe(false);
    });

    it('returns false on fetch error without throwing', async () => {
      const errorFetch: typeof fetch = async () => {
        throw new Error('Network error');
      };
      const svc = new GitHubStatusService(fakePrisma(), errorFetch, identityGitHubTokenDecryptor);

      const result = await svc.postStatus('tenant-1', {
        owner: 'acme',
        repo: 'api',
        sha: 'abc',
        state: 'success',
        description: 'ok',
      });

      expect(result).toBe(false);
    });

    it('truncates description to 140 characters', async () => {
      const { fetch: mockFetch, captured } = captureFetch();
      const svc = new GitHubStatusService(fakePrisma(), mockFetch, identityGitHubTokenDecryptor);

      const longDesc = 'A'.repeat(200);
      await svc.postStatus('tenant-1', {
        owner: 'acme',
        repo: 'api',
        sha: 'abc',
        state: 'failure',
        description: longDesc,
      });

      const body = JSON.parse(captured[0].init.body as string);
      expect(body.description.length).toBe(140);
      expect(body.description.endsWith('…')).toBe(true);
    });
  });

  describe('reportRunStart', () => {
    it('posts a pending status with run URL', async () => {
      const { fetch: mockFetch, captured } = captureFetch();
      const svc = new GitHubStatusService(fakePrisma(), mockFetch, identityGitHubTokenDecryptor);

      const result = await svc.reportRunStart('tenant-1', {
        owner: 'acme',
        repo: 'api',
        sha: 'sha-start',
        runId: 'run-42',
        runbookName: 'deploy-prod',
      });

      expect(result).toBe(true);
      const body = JSON.parse(captured[0].init.body as string);
      expect(body.state).toBe('pending');
      expect(body.description).toContain('deploy-prod');
      expect(body.context).toBe('nanorun/deploy-prod');
      expect(body.target_url).toContain('run-42');
    });
  });

  describe('reportRunEnd', () => {
    it('posts success status with duration', async () => {
      const { fetch: mockFetch, captured } = captureFetch();
      const svc = new GitHubStatusService(fakePrisma(), mockFetch, identityGitHubTokenDecryptor);

      await svc.reportRunEnd('tenant-1', {
        owner: 'acme',
        repo: 'api',
        sha: 'sha-end',
        runId: 'run-42',
        runbookName: 'deploy-prod',
        success: true,
        durationMs: 12500,
      });

      const body = JSON.parse(captured[0].init.body as string);
      expect(body.state).toBe('success');
      expect(body.description).toContain('12.5s');
    });

    it('posts failure status with error message', async () => {
      const { fetch: mockFetch, captured } = captureFetch();
      const svc = new GitHubStatusService(fakePrisma(), mockFetch, identityGitHubTokenDecryptor);

      await svc.reportRunEnd('tenant-1', {
        owner: 'acme',
        repo: 'api',
        sha: 'sha-end',
        runId: 'run-42',
        runbookName: 'deploy-prod',
        success: false,
        durationMs: 5000,
        error: 'Step "migrate" exited with code 1',
      });

      const body = JSON.parse(captured[0].init.body as string);
      expect(body.state).toBe('failure');
      expect(body.description).toContain('migrate');
    });
  });
});
