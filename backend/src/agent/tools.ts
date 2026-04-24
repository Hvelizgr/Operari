import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { ExecutionService } from '../editor/execution/execution.service';
import { ApprovalService, ApprovalServiceError } from '../runbook/services/approval.service';

// Avoid the `tool()` helper from 'ai': its generic inference combined
// with `streamText({ tools })` makes tsc OOM at >6 GB. The runtime
// contract is the same — a plain object with description / inputSchema
// / execute is all the SDK consumes.
const tool = <T>(def: T): T => def;

export interface OrchestratorToolsOptions {
  /**
   * Inject a pre-built ApprovalService so tests can mock it without
   * touching the singleton used by the real routes. Only read when
   * write tools are enabled.
   */
  approvalService?: ApprovalService;
  /**
   * Force-enable write tools regardless of the env flag. Useful for
   * tests; production paths go through CAIRN_AGENT_WRITE_TOOLS.
   */
  writeEnabled?: boolean;
}

/**
 * Tools for the Cairn orchestrator.
 *
 * READ tools (always on) give the assistant *eyes* into the tenant's
 * runs and runbooks. Every tool is bound to a single tenantId at
 * construction time so the model can never escape the tenant boundary.
 *
 * WRITE tools (opt-in via CAIRN_AGENT_WRITE_TOOLS=true) currently cover
 * approval grant/reject. They route through ApprovalService so the same
 * audit events, tenant isolation, and concurrency guards that gate the
 * HTTP API also gate the agent. The actor is recorded as
 * `agent:<tenantId>` in the audit chain.
 *
 * Deliberately NOT exposed as write tools:
 *   - trigger_runbook / cancel_run — too easy to blast prod
 *   - create/update/delete runbook — schema mutations stay human-only
 */
// Returned as a loose Record so the AI SDK's deep generic inference on
// streamText({ tools }) does not balloon tsc memory. The tool helper
// itself preserves its runtime contract — the looseness is a *type*
// shortcut only.
export function buildOrchestratorTools(
  prisma: PrismaClient,
  tenantId: string,
  options: OrchestratorToolsOptions = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  const readTools = {
    list_recent_runs: tool({
      description:
        'List recent runbook executions for the current tenant. ' +
        'Use this when the user asks "what failed today", "show me the last runs", ' +
        'or any question that requires looking at execution history.',
      inputSchema: z.object({
        status: z
          .enum(['RUNNING', 'SUCCESS', 'FAILED', 'PAUSED', 'CANCELLED', 'ANY'])
          .default('ANY')
          .describe('Filter by status; ANY returns runs of all statuses.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(10)
          .describe('Maximum number of runs to return (1-20).'),
      }),
      execute: async ({
        status,
        limit,
      }: {
        status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'CANCELLED' | 'ANY';
        limit: number;
      }) => {
        const runs = await prisma.execution.findMany({
          where: {
            workflow: { tenantId },
            ...(status === 'ANY' ? {} : { status }),
          },
          include: {
            workflow: { select: { slug: true, name: true } },
          },
          orderBy: { startedAt: 'desc' },
          take: limit,
        });
        return {
          runs: runs.map(r => ({
            id: r.id,
            runbook: r.workflow.name,
            slug: r.workflow.slug,
            status: r.status,
            trigger: r.trigger,
            startedAt: r.startedAt.toISOString(),
            durationMs: r.duration,
            error: r.error,
          })),
        };
      },
    }),

    get_run_details: tool({
      description:
        'Fetch full details for one run, including each step with status, ' +
        'output, and error. Use this when diagnosing a specific failure or ' +
        'when the user asks about a runId.',
      inputSchema: z.object({
        runId: z.string().describe('The run/execution id (uuid).'),
      }),
      execute: async ({ runId }: { runId: string }) => {
        const run = await prisma.execution.findFirst({
          where: {
            id: runId,
            workflow: { tenantId },
          },
          include: {
            nodeLogs: { orderBy: { startedAt: 'asc' } },
            workflow: { select: { slug: true, name: true } },
          },
        });
        if (!run) {
          return { error: 'run_not_found' };
        }
        return {
          id: run.id,
          runbook: run.workflow.name,
          slug: run.workflow.slug,
          status: run.status,
          trigger: run.trigger,
          startedAt: run.startedAt.toISOString(),
          completedAt: run.completedAt?.toISOString() ?? null,
          durationMs: run.duration,
          error: run.error,
          steps: run.nodeLogs.map(log => ({
            stepId: log.nodeId,
            name: log.nodeName,
            type: log.nodeType,
            status: log.status,
            durationMs: log.duration,
            // Truncate long outputs to keep the tool response bounded.
            output:
              typeof log.output === 'string' && log.output.length > 2000
                ? log.output.slice(0, 2000) + '… [truncated]'
                : log.output,
            error: log.error,
          })),
        };
      },
    }),

    get_step_logs: tool({
      description:
        'Fetch raw stdout, stderr, and output for a specific step within a run. ' +
        'Use this when the user asks for the logs of a particular step, or when ' +
        'get_run_details showed a failure and you need the full output.',
      inputSchema: z.object({
        runId: z.string().describe('The run/execution id (uuid).'),
        stepId: z.string().describe('The step/node id within the run.'),
      }),
      execute: async ({ runId, stepId }: { runId: string; stepId: string }) => {
        const log = await prisma.nodeLog.findFirst({
          where: {
            executionId: runId,
            nodeId: stepId,
            execution: { workflow: { tenantId } },
          },
        });
        if (!log) return { error: 'step_not_found' };

        const output = typeof log.output === 'string' ? log.output : JSON.stringify(log.output);
        return {
          stepId: log.nodeId,
          name: log.nodeName,
          type: log.nodeType,
          status: log.status,
          durationMs: log.duration,
          stdout:
            output && output.length > 8000
              ? output.slice(0, 8000) + '\n… [truncated at 8KB]'
              : output,
          error: log.error,
          startedAt: log.startedAt?.toISOString() ?? null,
          completedAt: log.completedAt?.toISOString() ?? null,
        };
      },
    }),

    search_runs_by_error: tool({
      description:
        'Search recent runs whose error message contains a given pattern. ' +
        'Use this when the user asks "has this error happened before" or ' +
        '"how many times has X failed".',
      inputSchema: z.object({
        pattern: z.string().min(3).describe('Substring to search for in error messages.'),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ pattern, limit }: { pattern: string; limit: number }) => {
        const runs = await prisma.execution.findMany({
          where: {
            workflow: { tenantId },
            error: { contains: pattern, mode: 'insensitive' },
          },
          include: {
            workflow: { select: { slug: true, name: true } },
          },
          orderBy: { startedAt: 'desc' },
          take: limit,
        });
        return {
          matchCount: runs.length,
          runs: runs.map(r => ({
            id: r.id,
            runbook: r.workflow.name,
            status: r.status,
            startedAt: r.startedAt.toISOString(),
            error: r.error && r.error.length > 500 ? r.error.slice(0, 500) + '…' : r.error,
          })),
        };
      },
    }),

    list_runbooks: tool({
      description:
        'List runbooks (workflows) defined in the current tenant. Use this ' +
        'when the user asks "what runbooks do I have", "do I have a runbook ' +
        'for X", or wants to discover what is already automated.',
      inputSchema: z.object({
        category: z
          .string()
          .optional()
          .describe('Optional category filter (e.g. "deploy", "incident").'),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ category, limit }: { category?: string; limit: number }) => {
        const runbooks = await prisma.runbook.findMany({
          where: {
            tenantId,
            ...(category ? { category } : {}),
          },
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            category: true,
            isActive: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        });
        return {
          runbooks: runbooks.map(r => ({
            slug: r.slug,
            name: r.name,
            description: r.description,
            category: r.category,
            active: r.isActive,
            updatedAt: r.updatedAt.toISOString(),
          })),
        };
      },
    }),
  };

  const writeEnabled = options.writeEnabled ?? process.env.CAIRN_AGENT_WRITE_TOOLS === 'true';
  if (!writeEnabled) return readTools;

  // Lazy-init the approval service. We wire resumeExecution through
  // ExecutionService so grants actually resume paused runs, mirroring
  // what the HTTP routes do.
  let approvalServiceInstance: ApprovalService | null = options.approvalService ?? null;
  const getApprovalService = (): ApprovalService => {
    if (approvalServiceInstance) return approvalServiceInstance;
    const executionService = new ExecutionService(prisma);
    approvalServiceInstance = new ApprovalService(prisma, {
      resumeExecution: executionService.resumeExecution.bind(executionService),
    });
    return approvalServiceInstance;
  };

  const resolveApproval = async (
    approvalId: string,
    action: 'grant' | 'reject',
    comment?: string
  ) => {
    try {
      const result = await getApprovalService().resolve({
        approvalId,
        action,
        tenantId,
        actorId: `agent:${tenantId}`,
        comment,
      });
      return {
        ok: true,
        approvalId: result.id,
        status: result.status,
        executionId: result.executionId,
        executionResumed: result.executionResumed,
        executionCancelled: result.executionCancelled,
      };
    } catch (err) {
      if (err instanceof ApprovalServiceError) {
        return { ok: false, code: err.code, message: err.message };
      }
      throw err;
    }
  };

  return {
    ...readTools,
    grant_approval: tool({
      description:
        'Grant a pending approval and resume its paused execution. ' +
        'WRITE ACTION — only call this after the user has explicitly ' +
        'confirmed they want the approval granted (e.g. "yes, grant approval abc123"). ' +
        'Do NOT grant proactively based on diagnosis alone.',
      inputSchema: z.object({
        approvalId: z.string().min(1).describe('The approval id the user asked to grant.'),
        comment: z
          .string()
          .max(500)
          .optional()
          .describe('Optional human-readable comment stored with the resolution.'),
      }),
      execute: async ({ approvalId, comment }: { approvalId: string; comment?: string }) =>
        resolveApproval(approvalId, 'grant', comment),
    }),
    reject_approval: tool({
      description:
        'Reject a pending approval. The matching paused execution is ' +
        'CANCELLED — downstream steps will not run. WRITE ACTION, ' +
        'irreversible: only call after explicit user confirmation.',
      inputSchema: z.object({
        approvalId: z.string().min(1).describe('The approval id the user asked to reject.'),
        comment: z
          .string()
          .max(500)
          .optional()
          .describe('Optional human-readable reason stored with the resolution.'),
      }),
      execute: async ({ approvalId, comment }: { approvalId: string; comment?: string }) =>
        resolveApproval(approvalId, 'reject', comment),
    }),
  };
}
