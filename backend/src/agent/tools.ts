import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';

// Avoid the `tool()` helper from 'ai': its generic inference combined
// with `streamText({ tools })` makes tsc OOM at >6 GB. The runtime
// contract is the same — a plain object with description / inputSchema
// / execute is all the SDK consumes.
const tool = <T>(def: T): T => def;

/**
 * Read-only tools for the NanoRun orchestrator.
 *
 * These give the assistant *eyes* into the tenant's runs and runbooks
 * without granting any write capability. The boundary is intentional:
 * the AI Assistant is for diagnosing and authoring, NOT for executing.
 * Anything that mutates state — trigger a run, create a runbook, grant
 * an approval — is the job of the Agents surface, which lives behind
 * an explicit user opt-in.
 *
 * Every tool is bound to a single tenantId at construction time so the
 * model can never escape the tenant boundary by passing a different id.
 */
// Returned as a loose Record so the AI SDK's deep generic inference on
// streamText({ tools }) does not balloon tsc memory. The tool helper
// itself preserves its runtime contract — the looseness is a *type*
// shortcut only.
export function buildOrchestratorTools(
    prisma: PrismaClient,
    tenantId: string,
): Record<string, any> {
    return {
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
                    runs: runs.map((r) => ({
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
                    steps: run.nodeLogs.map((log) => ({
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
                    stdout: output && output.length > 8000
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
                    runs: runs.map((r) => ({
                        id: r.id,
                        runbook: r.workflow.name,
                        status: r.status,
                        startedAt: r.startedAt.toISOString(),
                        error: r.error && r.error.length > 500
                            ? r.error.slice(0, 500) + '…'
                            : r.error,
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
            execute: async ({
                category,
                limit,
            }: {
                category?: string;
                limit: number;
            }) => {
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
                    runbooks: runbooks.map((r) => ({
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
}
