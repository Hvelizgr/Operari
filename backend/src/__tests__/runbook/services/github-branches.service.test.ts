import { GitHubBranchService } from '../../../runbook/services/github-branches.service';
import { identityGitHubTokenDecryptor } from '../../../security/github-token-resolver';

// ---------------------------------------------------------------------------
// Fake Prisma — mirrors the pattern used by github-status.service.test.ts.
// A null token simulates "tenant has no github connected account".
// ---------------------------------------------------------------------------

function fakePrisma(token: string | null = 'ghp_test-token') {
  return {
    connectedAccount: {
      findFirst: async () => (token ? { id: 'fake-account-id', accessToken: token } : null),
    },
  } as any;
}

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

// Record every outbound fetch the service makes and return a configurable
// JSON body. The service issues multiple calls per graph() invocation so
// the caller may need to inspect the full history, not just the first one.
function makeFetch(responses: Array<{ status?: number; body?: unknown }>) {
  const captured: CapturedRequest[] = [];
  let i = 0;
  const mockFetch = async (url: any, init: any) => {
    captured.push({ url: url as string, init });
    const r = responses[i] ?? responses[responses.length - 1];
    i++;
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => r.body,
      text: async () => JSON.stringify(r.body ?? {}),
    } as Response;
  };
  return { fetch: mockFetch as typeof fetch, captured };
}

describe('GitHubBranchService', () => {
  describe('findToken', () => {
    it('returns null when no connected account exists for the tenant', async () => {
      const svc = new GitHubBranchService(
        fakePrisma(null),
        makeFetch([]).fetch,
        identityGitHubTokenDecryptor
      );
      const token = await svc.findToken('tenant-1');
      expect(token).toBeNull();
    });

    it('decrypts and returns the stored token when an account exists', async () => {
      const svc = new GitHubBranchService(
        fakePrisma('ghp_secret'),
        makeFetch([]).fetch,
        identityGitHubTokenDecryptor
      );
      const token = await svc.findToken('tenant-1');
      expect(token).toBe('ghp_secret');
    });
  });

  describe('listBranches', () => {
    it('returns an empty array when the tenant has no token', async () => {
      const { fetch } = makeFetch([]);
      const svc = new GitHubBranchService(fakePrisma(null), fetch, identityGitHubTokenDecryptor);
      const branches = await svc.listBranches('tenant-1', 'acme', 'api');
      expect(branches).toEqual([]);
    });

    it('hits the correct GitHub API URL with Bearer auth', async () => {
      const { fetch, captured } = makeFetch([{ body: [] }]);
      const svc = new GitHubBranchService(
        fakePrisma('ghp_my-token'),
        fetch,
        identityGitHubTokenDecryptor
      );
      await svc.listBranches('tenant-1', 'acme', 'api');

      expect(captured[0].url).toBe('https://api.github.com/repos/acme/api/branches?per_page=100');
      const headers = captured[0].init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer ghp_my-token');
      expect(headers['Accept']).toBe('application/vnd.github+json');
      expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    });

    it('maps branch payloads to the canonical shape', async () => {
      const { fetch } = makeFetch([
        {
          body: [
            { name: 'main', commit: { sha: 'abc123' }, protected: true },
            { name: 'feat/x', commit: { sha: 'def456' }, protected: false },
          ],
        },
      ]);
      const svc = new GitHubBranchService(fakePrisma(), fetch, identityGitHubTokenDecryptor);
      const branches = await svc.listBranches('tenant-1', 'acme', 'api');
      expect(branches).toEqual([
        { name: 'main', sha: 'abc123', protected: true },
        { name: 'feat/x', sha: 'def456', protected: false },
      ]);
    });

    it('returns an empty array on non-2xx responses instead of throwing', async () => {
      const { fetch } = makeFetch([{ status: 404, body: { message: 'Not Found' } }]);
      const svc = new GitHubBranchService(fakePrisma(), fetch, identityGitHubTokenDecryptor);
      const branches = await svc.listBranches('tenant-1', 'acme', 'missing-repo');
      expect(branches).toEqual([]);
    });

    it('returns an empty array when the network itself fails', async () => {
      const failingFetch = (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch;
      const svc = new GitHubBranchService(fakePrisma(), failingFetch, identityGitHubTokenDecryptor);
      const branches = await svc.listBranches('tenant-1', 'acme', 'api');
      expect(branches).toEqual([]);
    });
  });

  describe('listCommits', () => {
    it('defaults to per_page=40 and no sha filter', async () => {
      const { fetch, captured } = makeFetch([{ body: [] }]);
      const svc = new GitHubBranchService(fakePrisma(), fetch, identityGitHubTokenDecryptor);
      await svc.listCommits('tenant-1', 'acme', 'api');
      expect(captured[0].url).toBe('https://api.github.com/repos/acme/api/commits?per_page=40');
    });

    it('honors sha + perPage options', async () => {
      const { fetch, captured } = makeFetch([{ body: [] }]);
      const svc = new GitHubBranchService(fakePrisma(), fetch, identityGitHubTokenDecryptor);
      await svc.listCommits('tenant-1', 'acme', 'api', {
        sha: 'main',
        perPage: 80,
      });
      expect(captured[0].url).toBe(
        'https://api.github.com/repos/acme/api/commits?per_page=80&sha=main'
      );
    });

    it('maps commits, trimming the message to the first line', async () => {
      const { fetch } = makeFetch([
        {
          body: [
            {
              sha: 'abc123',
              commit: {
                message: 'feat: add endpoint\n\nLong body goes here',
                author: { name: 'Alice', date: '2026-04-10T00:00:00Z' },
              },
              parents: [{ sha: 'parent-1' }, { sha: 'parent-2' }],
            },
          ],
        },
      ]);
      const svc = new GitHubBranchService(fakePrisma(), fetch, identityGitHubTokenDecryptor);
      const commits = await svc.listCommits('tenant-1', 'acme', 'api');
      expect(commits).toEqual([
        {
          sha: 'abc123',
          message: 'feat: add endpoint',
          author: 'Alice',
          date: '2026-04-10T00:00:00Z',
          parents: ['parent-1', 'parent-2'],
        },
      ]);
    });

    it('falls back to "unknown" author when missing', async () => {
      const { fetch } = makeFetch([
        {
          body: [
            {
              sha: 'abc',
              commit: { message: 'anonymous commit', author: null },
              parents: [],
            },
          ],
        },
      ]);
      const svc = new GitHubBranchService(fakePrisma(), fetch, identityGitHubTokenDecryptor);
      const commits = await svc.listCommits('tenant-1', 'acme', 'api');
      expect(commits[0].author).toBe('unknown');
      expect(commits[0].date).toBe('');
    });
  });

  describe('getGraph', () => {
    it('returns null when the tenant has no token', async () => {
      const svc = new GitHubBranchService(
        fakePrisma(null),
        makeFetch([]).fetch,
        identityGitHubTokenDecryptor
      );
      const graph = await svc.getGraph('tenant-1', 'acme', 'api');
      expect(graph).toBeNull();
    });

    it('returns null when both branches and commits come back empty', async () => {
      // Three calls: /repos/:o/:r, /branches, /commits.
      // All respond empty so the service decides there's no data.
      const { fetch } = makeFetch([
        { body: { default_branch: 'main' } },
        { body: [] },
        { body: [] },
      ]);
      const svc = new GitHubBranchService(fakePrisma(), fetch, identityGitHubTokenDecryptor);
      const graph = await svc.getGraph('tenant-1', 'acme', 'api');
      expect(graph).toBeNull();
    });

    it('composes a graph with branches, commits and the resolved default branch', async () => {
      const { fetch } = makeFetch([
        { body: { default_branch: 'develop' } },
        {
          body: [{ name: 'develop', commit: { sha: 'aaa' }, protected: true }],
        },
        {
          body: [
            {
              sha: 'aaa',
              commit: {
                message: 'first commit',
                author: { name: 'Bob', date: '2026-04-01T00:00:00Z' },
              },
              parents: [],
            },
          ],
        },
      ]);
      const svc = new GitHubBranchService(fakePrisma(), fetch, identityGitHubTokenDecryptor);
      const graph = await svc.getGraph('tenant-1', 'acme', 'api');
      expect(graph).not.toBeNull();
      expect(graph!.defaultBranch).toBe('develop');
      expect(graph!.branches).toHaveLength(1);
      expect(graph!.commits).toHaveLength(1);
    });

    it('falls back to "main" as default branch when the repo endpoint fails', async () => {
      // The repo endpoint errors, but branches + commits both succeed —
      // the service should still produce a graph with the fallback.
      const { fetch } = makeFetch([
        { status: 500, body: {} },
        {
          body: [{ name: 'main', commit: { sha: 'aaa' }, protected: true }],
        },
        {
          body: [
            {
              sha: 'aaa',
              commit: { message: 'c', author: null },
              parents: [],
            },
          ],
        },
      ]);
      const svc = new GitHubBranchService(fakePrisma(), fetch, identityGitHubTokenDecryptor);
      const graph = await svc.getGraph('tenant-1', 'acme', 'api');
      expect(graph!.defaultBranch).toBe('main');
    });
  });
});
