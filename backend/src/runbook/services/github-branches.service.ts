import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger.config';
import {
    type TokenDecryptor,
    createDefaultGitHubTokenDecryptor,
} from '../../security/github-token-resolver';

export interface GitHubBranch {
    name: string;
    sha: string;
    protected: boolean;
}

export interface GitHubCommit {
    sha: string;
    message: string;
    author: string;
    date: string;
    parents: string[];
}

export interface GitHubBranchGraph {
    branches: GitHubBranch[];
    commits: GitHubCommit[];
    defaultBranch: string;
}

/**
 * Fetches branch and commit data from GitHub for visualization.
 *
 * Follows the GitHubStatusService pattern: stateless, reads the token
 * from ConnectedAccount on each call, never throws on failure.
 *
 * The token comes from the first ConnectedAccount with provider="github"
 * for the tenant — same resolution as GitHubStatusService.findToken().
 */
export class GitHubBranchService {
    private readonly httpFetch: typeof fetch;
    private readonly decryptToken: TokenDecryptor;

    constructor(
        private readonly prisma: PrismaClient,
        httpFetch?: typeof fetch,
        decryptToken?: TokenDecryptor,
    ) {
        this.httpFetch = httpFetch ?? fetch;
        this.decryptToken = decryptToken ?? createDefaultGitHubTokenDecryptor(prisma);
    }

    /**
     * Resolve the tenant's GitHub token to a plaintext string. Returns
     * null if no ConnectedAccount exists or decryption fails. Reads the
     * ciphertext column and sends it through SecretReader so the audit
     * chain captures every access.
     */
    async findToken(tenantId: string): Promise<string | null> {
        const account = await this.prisma.connectedAccount.findFirst({
            where: { tenantId, provider: 'github' },
            select: { id: true, accessToken: true },
        });
        if (!account) return null;
        return this.decryptToken(
            account.accessToken,
            account.id,
            tenantId,
            'github-branch-service',
        );
    }

    private headers(token: string): Record<string, string> {
        return {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        };
    }

    async listBranches(
        tenantId: string,
        owner: string,
        repo: string,
    ): Promise<GitHubBranch[]> {
        const token = await this.findToken(tenantId);
        if (!token) {
            logger.warn({ tenantId, owner, repo }, 'No GitHub token found for tenant');
            return [];
        }

        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`;
            const response = await this.httpFetch(url, {
                headers: this.headers(token),
            });

            if (!response.ok) {
                const text = await response.text();
                logger.error(
                    { status: response.status, body: text, url },
                    'GitHub branches API returned non-2xx',
                );
                return [];
            }

            const data = await response.json() as Array<{
                name: string;
                commit: { sha: string };
                protected: boolean;
            }>;

            return data.map((b) => ({
                name: b.name,
                sha: b.commit.sha,
                protected: b.protected,
            }));
        } catch (err) {
            logger.error({ err, owner, repo }, 'Failed to fetch GitHub branches');
            return [];
        }
    }

    async listCommits(
        tenantId: string,
        owner: string,
        repo: string,
        options?: { sha?: string; perPage?: number },
    ): Promise<GitHubCommit[]> {
        const token = await this.findToken(tenantId);
        if (!token) {
            logger.warn({ tenantId, owner, repo }, 'No GitHub token found for tenant');
            return [];
        }

        try {
            const perPage = options?.perPage ?? 40;
            const sha = options?.sha ? `&sha=${options.sha}` : '';
            const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}${sha}`;
            const response = await this.httpFetch(url, {
                headers: this.headers(token),
            });

            if (!response.ok) {
                const text = await response.text();
                logger.error(
                    { status: response.status, body: text, url },
                    'GitHub commits API returned non-2xx',
                );
                return [];
            }

            const data = await response.json() as Array<{
                sha: string;
                commit: {
                    message: string;
                    author: { name: string; date: string } | null;
                };
                parents: Array<{ sha: string }>;
            }>;

            return data.map((c) => ({
                sha: c.sha,
                message: c.commit.message.split('\n')[0],
                author: c.commit.author?.name ?? 'unknown',
                date: c.commit.author?.date ?? '',
                parents: c.parents.map((p) => p.sha),
            }));
        } catch (err) {
            logger.error({ err, owner, repo }, 'Failed to fetch GitHub commits');
            return [];
        }
    }

    async getGraph(
        tenantId: string,
        owner: string,
        repo: string,
    ): Promise<GitHubBranchGraph | null> {
        const token = await this.findToken(tenantId);
        if (!token) {
            logger.warn({ tenantId, owner, repo }, 'No GitHub token found for tenant');
            return null;
        }

        // Fetch repo metadata for default branch
        let defaultBranch = 'main';
        try {
            const repoRes = await this.httpFetch(
                `https://api.github.com/repos/${owner}/${repo}`,
                { headers: this.headers(token) },
            );
            if (repoRes.ok) {
                const repoData = await repoRes.json() as { default_branch: string };
                defaultBranch = repoData.default_branch;
            }
        } catch {
            // Best-effort; fall back to "main"
        }

        const [branches, commits] = await Promise.all([
            this.listBranches(tenantId, owner, repo),
            this.listCommits(tenantId, owner, repo, { perPage: 80 }),
        ]);

        if (branches.length === 0 && commits.length === 0) {
            return null;
        }

        return { branches, commits, defaultBranch };
    }
}
