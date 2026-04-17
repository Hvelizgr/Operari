import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger.config';
import {
    type TokenDecryptor,
    createDefaultGitHubTokenDecryptor,
} from '../../security/github-token-resolver';

/**
 * GitHub commit status states.
 * @see https://docs.github.com/en/rest/commits/statuses#create-a-commit-status
 */
export type GitHubStatusState = 'pending' | 'success' | 'failure' | 'error';

export interface GitHubStatusParams {
    /** Owner/repo (e.g. "acme/api") */
    owner: string;
    repo: string;
    /** Full SHA of the commit to annotate */
    sha: string;
    /** Status state */
    state: GitHubStatusState;
    /** Short description shown in the PR checks list */
    description: string;
    /** URL linking back to the NanoRun run detail page */
    targetUrl?: string;
    /** Context string — the "check name" shown on GitHub (default: "nanorun") */
    context?: string;
}

/**
 * Posts commit statuses to GitHub via the Statuses API.
 *
 * Credentials come from ConnectedAccount (provider="github") whose
 * accessToken is a GitHub personal access token or GitHub App
 * installation token with `statuses:write` scope.
 *
 * This service is intentionally stateless — it reads the token from
 * ConnectedAccount on each call so token refreshes take effect
 * immediately. A future GitHub App integration will swap the token
 * resolution to use installation tokens with short-lived JWTs.
 */
export class GitHubStatusService {
    /** Override-able for tests. */
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
     * Resolve the tenant's GitHub token to plaintext. Reads the
     * ciphertext column and sends it through SecretReader so audit
     * captures every access. Returns null when no account exists or
     * decryption fails — either way, callers skip the GitHub side
     * effect instead of crashing the run.
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
            'github-status-service',
        );
    }

    /**
     * Post a commit status to GitHub.
     *
     * If no token is available for the tenant, logs a warning and
     * returns false (never throws — this is a best-effort side effect).
     */
    async postStatus(
        tenantId: string,
        params: GitHubStatusParams,
    ): Promise<boolean> {
        const token = await this.findToken(tenantId);
        if (!token) {
            logger.warn(
                { tenantId, owner: params.owner, repo: params.repo },
                'No GitHub token found for tenant — skipping status check',
            );
            return false;
        }

        const url = `https://api.github.com/repos/${params.owner}/${params.repo}/statuses/${params.sha}`;
        const body = JSON.stringify({
            state: params.state,
            description: truncate(params.description, 140),
            target_url: params.targetUrl,
            context: params.context ?? 'nanorun',
        });

        try {
            const response = await this.httpFetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
                body,
            });

            if (!response.ok) {
                const text = await response.text();
                logger.error(
                    { status: response.status, body: text, url },
                    'GitHub status API returned non-2xx',
                );
                return false;
            }

            logger.info(
                { owner: params.owner, repo: params.repo, sha: params.sha.slice(0, 8), state: params.state },
                'GitHub commit status posted',
            );
            return true;
        } catch (err) {
            logger.error(
                { err, url },
                'Failed to post GitHub commit status',
            );
            return false;
        }
    }

    /**
     * Convenience: post a "pending" status when a runbook starts,
     * then "success"/"failure"/"error" when it finishes. Called from
     * the webhook route and execution service respectively.
     */
    async reportRunStart(
        tenantId: string,
        meta: { owner: string; repo: string; sha: string; runId: string; runbookName: string },
    ): Promise<boolean> {
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        return this.postStatus(tenantId, {
            owner: meta.owner,
            repo: meta.repo,
            sha: meta.sha,
            state: 'pending',
            description: `Running: ${meta.runbookName}`,
            targetUrl: `${appUrl}/runs/${meta.runId}`,
            context: `nanorun/${meta.runbookName}`,
        });
    }

    async reportRunEnd(
        tenantId: string,
        meta: {
            owner: string;
            repo: string;
            sha: string;
            runId: string;
            runbookName: string;
            success: boolean;
            durationMs: number;
            error?: string;
        },
    ): Promise<boolean> {
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const durationSec = (meta.durationMs / 1000).toFixed(1);
        return this.postStatus(tenantId, {
            owner: meta.owner,
            repo: meta.repo,
            sha: meta.sha,
            state: meta.success ? 'success' : 'failure',
            description: meta.success
                ? `Passed in ${durationSec}s`
                : truncate(meta.error ?? 'Run failed', 140),
            targetUrl: `${appUrl}/runs/${meta.runId}`,
            context: `nanorun/${meta.runbookName}`,
        });
    }
}

function truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
