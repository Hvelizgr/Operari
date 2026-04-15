import {
    NanoRunConfig,
    RunbookSummary,
    TriggerOptions,
    TriggerResponse,
    Run,
    RunStatus,
    AuditVerifyOptions,
    AuditVerifyResult,
    ResolveApprovalOptions,
    ResolvedApproval,
} from './types';
import {
    NanoRunError,
    NanoRunAuthError,
    NanoRunNotFoundError,
    NanoRunTimeoutError,
} from './errors';

const DEFAULT_BASE_URL = 'https://api.nanorun.dev';

/**
 * Official Node.js client for the NanoRun API.
 *
 * Quick start:
 *
 * ```ts
 * import { NanoRun } from '@cairn/sdk';
 *
 * const client = new NanoRun({ apiKey: process.env.NANORUN_API_KEY! });
 *
 * // Trigger a runbook
 * const run = await client.trigger('deploy-frontend', {
 *   variables: { env: 'production' },
 * });
 *
 * // Wait for completion
 * const finalRun = await client.waitForCompletion(run.id);
 * console.log(finalRun.status); // SUCCESS
 * ```
 */
export class NanoRun {
    private readonly apiKey: string;
    private readonly baseURL: string;
    private readonly fetchImpl: typeof fetch;

    constructor(config: NanoRunConfig) {
        if (!config.apiKey) {
            throw new NanoRunError('apiKey is required');
        }
        this.apiKey = config.apiKey;
        this.baseURL = (config.baseURL || DEFAULT_BASE_URL).replace(/\/$/, '');
        this.fetchImpl = config.fetch || fetch;
    }

    /** List all runbooks accessible to this API key. */
    async listRunbooks(): Promise<RunbookSummary[]> {
        const res = await this.request<{ data: RunbookSummary[] }>('GET', '/api/v1/runbooks');
        return res.data;
    }

    /**
     * Trigger a runbook by slug or id.
     * Returns immediately with the run record (async execution).
     * Use `waitForCompletion(run.id)` to block until done.
     */
    async trigger(
        runbookSlugOrId: string,
        options: TriggerOptions = {},
    ): Promise<TriggerResponse> {
        return this.request<TriggerResponse>(
            'POST',
            `/api/v1/runbooks/${encodeURIComponent(runbookSlugOrId)}/trigger`,
            { variables: options.variables ?? {} },
        );
    }

    /** Get the current state of a run. */
    async getRun(runId: string): Promise<Run> {
        return this.request<Run>('GET', `/api/v1/runs/${encodeURIComponent(runId)}`);
    }

    /**
     * Poll a run until it reaches a terminal state (SUCCESS, FAILED, CANCELLED).
     *
     * @param runId The run id to poll
     * @param options.timeoutMs Maximum time to wait (default: 5 minutes)
     * @param options.pollIntervalMs Polling interval (default: 1 second)
     */
    async waitForCompletion(
        runId: string,
        options: { timeoutMs?: number; pollIntervalMs?: number } = {},
    ): Promise<Run> {
        const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
        const pollIntervalMs = options.pollIntervalMs ?? 1000;
        const terminalStates: RunStatus[] = ['SUCCESS', 'FAILED', 'CANCELLED'];

        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const run = await this.getRun(runId);
            if (terminalStates.includes(run.status)) {
                return run;
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
        throw new NanoRunTimeoutError(`Run ${runId} did not complete within ${timeoutMs}ms`);
    }

    /**
     * Convenience: trigger a runbook AND wait for it to finish.
     * Throws if the run fails.
     */
    async run(
        runbookSlugOrId: string,
        options: TriggerOptions & { timeoutMs?: number } = {},
    ): Promise<Run> {
        const triggered = await this.trigger(runbookSlugOrId, options);
        const final = await this.waitForCompletion(triggered.id, { timeoutMs: options.timeoutMs });
        if (final.status === 'FAILED') {
            throw new NanoRunError(`Run failed: ${final.error || 'unknown error'}`, 500, 'run_failed', final);
        }
        return final;
    }

    /**
     * Grant a pending approval and resume its paused execution.
     *
     * Requires API key scope `approvals:resolve`. Throws
     * `NanoRunNotFoundError` if the approval id does not exist (also used
     * when it belongs to another tenant — by design).
     */
    async grantApproval(
        approvalId: string,
        options: ResolveApprovalOptions = {},
    ): Promise<ResolvedApproval> {
        return this.request<ResolvedApproval>(
            'POST',
            `/api/v1/approvals/${encodeURIComponent(approvalId)}/grant`,
            { comment: options.comment },
        );
    }

    /**
     * Reject a pending approval. The matching execution is cancelled —
     * downstream steps will NOT run. Requires scope `approvals:resolve`.
     */
    async rejectApproval(
        approvalId: string,
        options: ResolveApprovalOptions = {},
    ): Promise<ResolvedApproval> {
        return this.request<ResolvedApproval>(
            'POST',
            `/api/v1/approvals/${encodeURIComponent(approvalId)}/reject`,
            { comment: options.comment },
        );
    }

    /**
     * Verify the audit chain for the tenant owning this API key.
     *
     * NanoRun stores tamper-evident audit events in a hash chain. This
     * method walks the chain and reports whether every hash recomputes
     * correctly and whether the seq column is contiguous. Use it from
     * compliance automation, or directly from the CLI:
     *
     *   cairn audit verify
     *
     * Requires an API key with scope `audit:read`.
     */
    async verifyAudit(options: AuditVerifyOptions = {}): Promise<AuditVerifyResult> {
        const params = new URLSearchParams();
        if (options.fromSeq !== undefined) {
            params.set('fromSeq', String(options.fromSeq));
        }
        if (options.pageSize !== undefined) {
            params.set('pageSize', String(options.pageSize));
        }
        const qs = params.toString();
        const path = qs ? `/api/v1/audit/verify?${qs}` : '/api/v1/audit/verify';
        return this.request<AuditVerifyResult>('GET', path);
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
    ): Promise<T> {
        const url = `${this.baseURL}${path}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': '@cairn/sdk/0.1.0',
        };

        const response = await this.fetchImpl(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        const text = await response.text();
        let data: unknown;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = text;
        }

        if (!response.ok) {
            const errPayload = (data as { error?: string; code?: string; details?: unknown }) || {};
            const message = errPayload.error || `Request failed: ${response.status}`;

            if (response.status === 401) throw new NanoRunAuthError(message);
            if (response.status === 404) throw new NanoRunNotFoundError(message);
            throw new NanoRunError(message, response.status, errPayload.code, errPayload.details);
        }

        return data as T;
    }
}
