import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { AuditEventType, AuditService } from '../audit/audit.service';
import { assertRunbookQuota, QuotaExceededError } from '../billing/quotas';
import { AuthRequest } from '../middleware/auth.middleware';
import { RunbookVersionService } from '../runbook/services/runbook-version.service';
import {
  fromSpec,
  RunbookSerializerError,
  specToYaml,
  toSpec,
  yamlToSpec,
} from '../runbook/yaml/runbook-serializer';
import { extractAccountRefs } from '../runbook/utils/extract-account-refs';
import { validateRunbookSpec } from '../runbook/yaml/schema-validator';
import { prisma } from '../server';
import { RunbookValidatorService } from '../services/runbook-validator.service';
import { computeNextRunAt } from '../services/scheduler.service';
import {
  runbookInputDefinitionSchema,
  WorkflowConnection,
  workflowConnectionSchema,
  WorkflowDefinition,
  workflowDefinitionSchema,
  WorkflowNode,
  workflowNodeSchema,
} from '../types/runbook.types';

const router = Router();

// Lazy singleton — same pattern as v1/audit.routes.ts and v1/approvals.routes.ts
let auditService: AuditService | null = null;
function getAudit(): AuditService {
  if (!auditService) auditService = new AuditService(prisma);
  return auditService;
}

let versionService: RunbookVersionService | null = null;
function getVersioner(): RunbookVersionService {
  if (!versionService) versionService = new RunbookVersionService(prisma);
  return versionService;
}

/**
 * Fire-and-forget wrapper around RunbookVersionService.createVersion.
 * The save response should never fail because the version ledger
 * couldn't write — the mutable Runbook row already holds the new
 * definition. A failed version write leaves a verifier-detectable gap
 * (same contract as the audit chain).
 */
async function safeCreateVersion(runbookId: string, actorId: string): Promise<void> {
  try {
    await getVersioner().createVersion({ runbookId, actorId });
  } catch (err) {
    // intentional: log-level only; callers must not know about this.

    console.warn('runbook-version: createVersion failed', { runbookId, err });
  }
}

/**
 * True when an update payload touched the definition (nodes /
 * connections / inputs / name / description / category /
 * onErrorRunbookId). isActive + schedule flips alone do NOT bump
 * the version — the DAG is identical, so a new snapshot would just
 * inflate the ledger.
 */
function updateChangedDefinition(data: Record<string, unknown>): boolean {
  return (
    data.nodes !== undefined ||
    data.connections !== undefined ||
    data.inputs !== undefined ||
    data.name !== undefined ||
    data.description !== undefined ||
    data.category !== undefined ||
    data.onErrorRunbookId !== undefined
  );
}

/**
 * Fire-and-forget audit hook for runbook CRUD. Failures are swallowed
 * so a broken audit chain never blocks runbook management.
 */
async function safeAuditWorkflow(
  type: 'runbook.created' | 'runbook.updated' | 'runbook.deleted',
  params: {
    tenantId: string;
    actorId: string;
    runbookId: string;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await getAudit().record({
      tenantId: params.tenantId,
      type: type as AuditEventType,
      actorId: params.actorId,
      actorType: 'user',
      resource: params.runbookId,
      payload: params.payload,
    });
  } catch {
    // never block the response
  }
}

// Authentication disabled for free usage per n8n policies
// router.use(authenticate);

// Set default anonymous user for public API access
router.use((req: AuthRequest, _res, next) => {
  if (!req.user) {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@operari.local',
      role: 'USER',
      tenantId: 'default-tenant',
    };
  }
  next();
});

/**
 * @swagger
 * /workflows:
 *   get:
 *     summary: List workflows
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of workflows
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workflows:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Workflow'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     pages: { type: integer }
 *             example:
 *               workflows:
 *                 - id: "wf-123"
 *                   name: "New Order Processing"
 *                   description: "Handles Shopify orders"
 *                   isActive: true
 *                   updatedAt: "2024-03-21T15:30:00Z"
 *               pagination:
 *                 page: 1
 *                 limit: 10
 *                 total: 1
 *                 pages: 1
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', limit = '10', search = '' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where = {
      tenantId: req.user!.tenantId,
      ...(search && {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' as const } },
          { description: { contains: search as string, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [workflows, total] = await Promise.all([
      prisma.runbook.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { executions: true } },
        },
      }),
      prisma.runbook.count({ where }),
    ]);

    // Enrich each runbook with its last run + 30-day success rate so
    // the Runbooks page can render rich cards in a single round-trip.
    // Two queries fan out across the page:
    //   1. last execution per runbook (one findMany, sorted desc)
    //   2. groupBy status over the last 30 days
    // Both are bounded by the page size (default 10).
    const ids = workflows.map(w => w.id);
    let lastRunByWf = new Map<string, { startedAt: Date; status: string }>();
    let successRateByWf = new Map<string, number>();
    // Up to 20 most recent statuses per runbook, oldest first, for a
    // sparkline strip on the runbook card. Built from the same
    // `recentRuns` read that feeds `lastRunStatus` so no extra DB hit.
    const recentStatusesByWf = new Map<string, string[]>();
    if (ids.length > 0) {
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      // `ids` comes from a tenant-scoped runbook.findMany above, so the
      // executions joined on those ids are already tenant-isolated by
      // construction. The explicit tenantId here is for the runtime
      // tenant-scope guard (middleware/tenant-scope-guard.ts) which
      // refuses any Execution query without an explicit tenant filter
      // — without it the guard throws under ts-node-dev and kills the
      // process the next time this list endpoint is hit.
      const tenantId = req.user!.tenantId;
      const [recentRuns, statusGroups] = await Promise.all([
        prisma.execution.findMany({
          where: { tenantId, runbookId: { in: ids } },
          orderBy: { startedAt: 'desc' },
          select: { runbookId: true, startedAt: true, status: true },
        }),
        prisma.execution.groupBy({
          by: ['runbookId', 'status'],
          where: {
            tenantId,
            runbookId: { in: ids },
            startedAt: { gte: since30d },
          },
          _count: { _all: true },
        }),
      ]);
      // Collect last-20 per runbook inline so we walk `recentRuns`
      // only once. Rows arrive newest-first, so we push then reverse
      // the bucket at the end to hand the frontend a chronological
      // (left→right) array.
      const SPARK_SLOTS = 20;
      for (const r of recentRuns) {
        if (!lastRunByWf.has(r.runbookId)) {
          lastRunByWf.set(r.runbookId, {
            startedAt: r.startedAt,
            status: r.status,
          });
        }
        const bucket = recentStatusesByWf.get(r.runbookId);
        if (!bucket) {
          recentStatusesByWf.set(r.runbookId, [r.status]);
        } else if (bucket.length < SPARK_SLOTS) {
          bucket.push(r.status);
        }
      }
      for (const [wfId, bucket] of recentStatusesByWf) {
        recentStatusesByWf.set(wfId, bucket.reverse());
      }
      const totalsByWf = new Map<string, number>();
      const successByWf = new Map<string, number>();
      for (const g of statusGroups) {
        totalsByWf.set(g.runbookId, (totalsByWf.get(g.runbookId) ?? 0) + g._count._all);
        if (g.status === 'SUCCESS') {
          successByWf.set(g.runbookId, (successByWf.get(g.runbookId) ?? 0) + g._count._all);
        }
      }
      for (const [wfId, total] of totalsByWf) {
        if (total > 0) {
          successRateByWf.set(wfId, (successByWf.get(wfId) ?? 0) / total);
        }
      }
    }

    const enriched = workflows.map(w => ({
      ...w,
      lastRunAt: lastRunByWf.get(w.id)?.startedAt ?? null,
      lastRunStatus: lastRunByWf.get(w.id)?.status ?? null,
      successRate30d: successRateByWf.get(w.id) ?? null,
      recentStatuses: recentStatusesByWf.get(w.id) ?? [],
    }));

    res.json({
      runbooks: enriched,
      // Deprecated alias — the frontend clients still on <= v0.5 read
      // `workflows`. Will be removed once the marketing pivot rename
      // lands across every consumer (tracked by the fase 2b rename
      // work). Mirror the same array so swapping one key doesn't
      // double the payload.
      workflows: enriched,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    req.log.error({ error }, 'Get workflows error');
    res.status(500).json({ error: 'Failed to get workflows' });
  }
});

/**
 * @swagger
 * /workflows/{id}:
 *   get:
 *     summary: Get a runbook by ID
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Workflow details
 *         content:
 *           application/json:
 *             example:
 *               id: "wf-123"
 *               name: "Daily Report"
 *               nodes:
 *                 - id: "node-1"
 *                   type: "Schedule"
 *                   position: { x: 0, y: 0 }
 *                   config: { cron: "0 0 * * *" }
 *               connections:
 *                 - id: "c-1"
 *                   source: "node-1"
 *                   target: "node-2"
 *               isActive: true
 *       404:
 *         description: Workflow not found
 *         content:
 *           application/json:
 *             example:
 *               error: "Workflow not found"
 */
/**
 * GET /workflows/lineage
 *
 * Build the cross-runbook call graph for the current tenant. We walk
 * every runbook's `nodes` JSON looking for two kinds of edges:
 *
 *   - `runbook` step nodes whose `config.ref` points at another
 *     runbook (id or slug). These are sub-run dependencies.
 *   - The runbook's own `onErrorRunbookId` field. These are
 *     fire-on-failure handlers.
 *
 * Returns a normalized graph the frontend renders with React Flow.
 * Edges that reference a runbook outside the tenant (or a slug we
 * can't resolve) are dropped silently — they're either deleted
 * targets or the user's history of cross-tenant fragments. Surfacing
 * them as red edges would be noisier than helpful.
 *
 * Route order matters: this must be registered BEFORE `/:id` so
 * Express doesn't treat the literal `lineage` as a runbook id and
 * 404 us out.
 */
router.get('/lineage', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const runbooks = await prisma.runbook.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        nodes: true,
        onErrorRunbookId: true,
      },
      orderBy: { name: 'asc' },
    });

    const slugToId = new Map<string, string>();
    for (const r of runbooks) {
      if (r.slug) slugToId.set(r.slug, r.id);
    }
    const idSet = new Set(runbooks.map(r => r.id));

    type LineageEdge = {
      source: string;
      target: string;
      // - runbook-step:  explicit `runbook` step calls another runbook
      // - on-error:      runbook-level fallback (Runbook.onErrorRunbookId)
      // - hook-success:  per-step `_onSuccess` hook (fire-and-forget child)
      // - hook-failure:  per-step `_onFailure` hook (fire-and-forget child)
      // The two hook kinds are distinct from on-error because they fire
      // off any step terminal state, not only when the parent run errors.
      kind: 'runbook-step' | 'on-error' | 'hook-success' | 'hook-failure';
      stepId?: string;
      stepName?: string;
    };
    const edges: LineageEdge[] = [];

    // Helper: resolve a hook ref (id or slug) to a runbook id we know.
    // Drops refs to runbooks the user can't see (cross-tenant typos,
    // deleted children) — silent so the graph stays clean.
    const resolveRef = (ref: string): string | null => {
      const trimmed = ref.trim();
      if (!trimmed) return null;
      if (idSet.has(trimmed)) return trimmed;
      return slugToId.get(trimmed) ?? null;
    };

    for (const runbook of runbooks) {
      if (runbook.onErrorRunbookId && idSet.has(runbook.onErrorRunbookId)) {
        edges.push({
          source: runbook.id,
          target: runbook.onErrorRunbookId,
          kind: 'on-error',
        });
      }
      const nodes = Array.isArray(runbook.nodes) ? runbook.nodes : [];
      for (const node of nodes as Array<Record<string, unknown>>) {
        if (typeof node !== 'object' || node === null) continue;
        const cfg = (node.config ?? {}) as Record<string, unknown>;
        const stepId = typeof node.id === 'string' ? node.id : undefined;
        const stepName = typeof node.name === 'string' ? node.name : undefined;

        // Existing: explicit runbook-call edges.
        if (node.type === 'runbook' || node.type === 'operari.runbook') {
          const ref = typeof cfg.ref === 'string' ? cfg.ref : '';
          const targetId = resolveRef(ref);
          if (targetId) {
            edges.push({
              source: runbook.id,
              target: targetId,
              kind: 'runbook-step',
              stepId,
              stepName,
            });
          }
        }

        // Step lifecycle hooks fire a child runbook on terminal state.
        // Both apply to every step type, not just `runbook` calls.
        if (typeof cfg._onSuccess === 'string') {
          const targetId = resolveRef(cfg._onSuccess);
          if (targetId) {
            edges.push({
              source: runbook.id,
              target: targetId,
              kind: 'hook-success',
              stepId,
              stepName,
            });
          }
        }
        if (typeof cfg._onFailure === 'string') {
          const targetId = resolveRef(cfg._onFailure);
          if (targetId) {
            edges.push({
              source: runbook.id,
              target: targetId,
              kind: 'hook-failure',
              stepId,
              stepName,
            });
          }
        }
      }
    }

    const lineageNodes = runbooks.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      category: r.category,
    }));

    res.json({ nodes: lineageNodes, edges });
  } catch (error) {
    req.log.error({ error }, 'Get runbook lineage error');
    res.status(500).json({ error: 'Failed to build runbook lineage' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const runbookId = req.params.id as string;
    const runbook = await prisma.runbook.findFirst({
      where: {
        id: runbookId,
        tenantId: req.user!.tenantId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        executions: {
          take: 10,
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!runbook) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Tier C edge data — derive cross-environment markers per
    // connection so the canvas can chevron-style edges that span
    // envs (prod → staging fanouts caught at author time). We
    // walk each node's config to collect connected-account ids,
    // pull `metadata.env` from those accounts in one batched
    // query, and stamp `crossEnv` onto any connection whose
    // source/target sides resolve to different envs. Skipped
    // entirely when nothing references an account or no account
    // has an env tag — frontend renders the chip only when the
    // field is populated.
    const augmented = await augmentConnectionsWithCrossEnv(runbook, req.user!.tenantId).catch(
      err => {
        req.log.warn({ err, runbookId }, 'crossEnv derivation failed; falling back');
        return runbook;
      }
    );

    res.json(augmented);
  } catch (error) {
    req.log.error({ error }, 'Get runbook error');
    res.status(500).json({ error: 'Failed to get runbook' });
  }
});

type RunbookLike = {
  nodes?: unknown;
  connections?: unknown;
} & Record<string, unknown>;

async function augmentConnectionsWithCrossEnv(
  runbook: RunbookLike,
  tenantId: string
): Promise<RunbookLike> {
  const nodes = Array.isArray(runbook.nodes)
    ? (runbook.nodes as Array<Record<string, unknown>>)
    : [];
  const connections = Array.isArray(runbook.connections)
    ? (runbook.connections as Array<Record<string, unknown>>)
    : [];
  if (nodes.length === 0 || connections.length === 0) return runbook;

  const refsByNodeId = new Map<string, string[]>();
  const allRefs = new Set<string>();
  for (const node of nodes) {
    const id = typeof node.id === 'string' ? node.id : null;
    if (!id) continue;
    const refs = extractAccountRefs(node.config);
    if (refs.length > 0) {
      refsByNodeId.set(id, refs);
      for (const r of refs) allRefs.add(r);
    }
  }
  if (allRefs.size === 0) return runbook;

  const accounts = await prisma.connectedAccount.findMany({
    where: { tenantId, id: { in: [...allRefs] } },
    select: { id: true, metadata: true },
  });
  const envByAccountId = new Map<string, string>();
  for (const acc of accounts) {
    const meta = acc.metadata as { env?: unknown } | null;
    const env = meta && typeof meta.env === 'string' ? meta.env.trim() : '';
    if (env.length > 0) envByAccountId.set(acc.id, env);
  }
  if (envByAccountId.size === 0) return runbook;

  const envsForNode = (nodeId: string): Set<string> => {
    const refs = refsByNodeId.get(nodeId) ?? [];
    const envs = new Set<string>();
    for (const r of refs) {
      const env = envByAccountId.get(r);
      if (env) envs.add(env);
    }
    return envs;
  };

  let mutated = false;
  const nextConnections = connections.map(conn => {
    const source = typeof conn.source === 'string' ? conn.source : null;
    const target = typeof conn.target === 'string' ? conn.target : null;
    if (!source || !target) return conn;
    const srcEnvs = envsForNode(source);
    const tgtEnvs = envsForNode(target);
    if (srcEnvs.size === 0 || tgtEnvs.size === 0) return conn;
    // Connection is cross-env when the two sides have NO env in
    // common — picking the first deterministic-sorted env on each
    // side gives a stable label even when a node references several
    // accounts in the same environment.
    for (const e of srcEnvs) if (tgtEnvs.has(e)) return conn;
    const srcLabel = [...srcEnvs].sort()[0];
    const tgtLabel = [...tgtEnvs].sort()[0];
    mutated = true;
    return { ...conn, crossEnv: { source: srcLabel, target: tgtLabel } };
  });

  if (!mutated) return runbook;
  return { ...runbook, connections: nextConnections };
}

/**
 * @swagger
 * /workflows/{id}/metadata:
 *   get:
 *     summary: Get runbook metadata (updatedAt)
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Workflow metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 lastModified: { type: integer }
 *       404:
 *         description: Workflow not found
 */
router.get('/:id/metadata', async (req: AuthRequest, res) => {
  try {
    const runbookId = req.params.id as string;
    const runbook = await prisma.runbook.findFirst({
      where: {
        id: runbookId,
        tenantId: req.user!.tenantId,
      },
      select: {
        id: true,
        updatedAt: true,
      },
    });

    if (!runbook) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({
      id: runbook.id,
      lastModified: runbook.updatedAt.getTime(),
    });
  } catch (error) {
    req.log.error({ error }, 'Get runbook metadata error');
    res.status(500).json({ error: 'Failed to get runbook metadata' });
  }
});

/**
 * GET /workflows/:id/step-stats
 *
 * Per-step run statistics powering the editor's "Show stats" overlay
 * (run-history strip + p95 / failure-rate heat coloring on each node).
 * One round-trip aggregates every NodeLog row in the time window.
 *
 * Query params:
 *   - since: lookback in ms (default 30d, max 90d). Clamped to keep the
 *     in-memory percentile sort cheap for hot runbooks.
 *
 * Response shape, keyed by nodeId:
 *   {
 *     nodeId: {
 *       runs:           total terminal logs in window
 *       successRate:    SUCCESS / (SUCCESS + FAILED), null if no terminal runs
 *       failureRate:    1 - successRate
 *       p50DurationMs:  median of completed-run durations
 *       p95DurationMs:  95th percentile (Math.ceil indexing)
 *       recent:         last 5 terminal runs, newest-first
 *                       [{ status, startedAt, durationMs }]
 *     }
 *   }
 *
 * SKIPPED / PENDING / RUNNING are excluded — they would skew the
 * percentile (no duration) and the failure rate (not a real outcome).
 */
router.get('/:id/step-stats', async (req: AuthRequest, res) => {
  try {
    const runbookId = req.params.id as string;
    const sinceMs = Math.min(
      Math.max(parseInt((req.query.since as string) ?? '', 10) || 30 * 24 * 60 * 60 * 1000, 0),
      90 * 24 * 60 * 60 * 1000
    );
    const since = new Date(Date.now() - sinceMs);

    const runbook = await prisma.runbook.findFirst({
      where: { id: runbookId, tenantId: req.user!.tenantId },
      select: { id: true },
    });
    if (!runbook) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Pull every terminal NodeLog in the window. Sorted desc so the
    // first 5 entries we collect per nodeId are the newest. The
    // tenantId filter rides the denormalized column so this never
    // joins through Execution.
    const logs = await prisma.nodeLog.findMany({
      where: {
        tenantId: req.user!.tenantId,
        execution: { runbookId },
        status: { in: ['SUCCESS', 'FAILED'] },
        startedAt: { gte: since },
      },
      select: {
        nodeId: true,
        status: true,
        startedAt: true,
        duration: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    type Bucket = {
      durations: number[];
      success: number;
      failed: number;
      recent: Array<{ status: string; startedAt: Date; durationMs: number | null }>;
    };
    const byNode = new Map<string, Bucket>();
    for (const log of logs) {
      let bucket = byNode.get(log.nodeId);
      if (!bucket) {
        bucket = { durations: [], success: 0, failed: 0, recent: [] };
        byNode.set(log.nodeId, bucket);
      }
      if (log.status === 'SUCCESS') bucket.success += 1;
      else if (log.status === 'FAILED') bucket.failed += 1;
      if (typeof log.duration === 'number') bucket.durations.push(log.duration);
      if (bucket.recent.length < 5) {
        bucket.recent.push({
          status: log.status,
          startedAt: log.startedAt,
          durationMs: log.duration ?? null,
        });
      }
    }

    const percentile = (sorted: number[], p: number): number | null => {
      if (sorted.length === 0) return null;
      if (sorted.length === 1) return sorted[0]!;
      const rank = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, Math.min(sorted.length - 1, rank))]!;
    };

    const stats: Record<
      string,
      {
        runs: number;
        successRate: number | null;
        failureRate: number | null;
        p50DurationMs: number | null;
        p95DurationMs: number | null;
        recent: Array<{ status: string; startedAt: Date; durationMs: number | null }>;
      }
    > = {};
    for (const [nodeId, bucket] of byNode) {
      const terminal = bucket.success + bucket.failed;
      const sortedDurations = [...bucket.durations].sort((a, b) => a - b);
      const successRate = terminal > 0 ? bucket.success / terminal : null;
      stats[nodeId] = {
        runs: terminal,
        successRate,
        failureRate: successRate === null ? null : 1 - successRate,
        p50DurationMs: percentile(sortedDurations, 50),
        p95DurationMs: percentile(sortedDurations, 95),
        recent: bucket.recent,
      };
    }

    res.json({ runbookId, sinceMs, stats });
  } catch (error) {
    req.log.error({ error }, 'Get runbook step-stats error');
    res.status(500).json({ error: 'Failed to get runbook step stats' });
  }
});

/**
 * @swagger
 * /workflows:
 *   post:
 *     summary: Create a new runbook
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, nodes, connections]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *               schedule: { type: string }
 *               nodes: { type: array, items: { type: object } }
 *               connections: { type: array, items: { type: object } }
 *           example:
 *             name: "New Automation"
 *             description: "Created via API"
 *             nodes: []
 *             connections: []
 *             isActive: false
 *     responses:
 *       201:
 *         description: Workflow created
 *         content:
 *           application/json:
 *             example:
 *               id: "wf-new-789"
 *               name: "New Automation"
 *               createdAt: "2024-03-22T09:00:00Z"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               error: "Name is required"
 */
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = workflowDefinitionSchema.parse(req.body);

    // Plan quota gate. Enforced BEFORE logic validation so a
    // FREE tenant at the runbook cap gets a clean 402 instead
    // of investing time in a form they cannot submit. Anonymous
    // mode bypasses (self-host has no plan concept).
    try {
      await assertRunbookQuota(prisma, req.user!.tenantId);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        // Emit an audit event so the billing dashboard can
        // pivot by "tenants that hit their cap". Fire-and-
        // forget — audit failure must not override the 402.
        try {
          const audit = new AuditService(prisma);
          await audit.record({
            tenantId: req.user!.tenantId,
            type: 'quota.exceeded',
            actorId: req.user!.id,
            actorType: 'user',
            resource: req.user!.tenantId,
            payload: {
              resource: err.resource,
              current: err.current,
              limit: err.limit,
              attempt: 'runbook.create',
            },
          });
        } catch {
          /* observability only */
        }
        return res.status(402).json({
          error: err.message,
          resource: err.resource,
          current: err.current,
          limit: err.limit,
          upgrade: '/api/billing/checkout',
        });
      }
      throw err;
    }

    // Validate logic
    const validator = new RunbookValidatorService();
    const validation = validator.validate(data as WorkflowDefinition);

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Workflow validation failed',
        issues: validation.issues,
      });
    }

    // Validate onErrorRunbookId: must belong to same tenant and
    // must not be self-referential. We check tenant explicitly
    // here (instead of trusting the schema) because the id comes
    // from a client body and we cannot let one tenant wire its
    // error handler to another tenant's runbook.
    if (data.onErrorRunbookId) {
      const handler = await prisma.runbook.findFirst({
        where: { id: data.onErrorRunbookId, tenantId: req.user!.tenantId },
        select: { id: true },
      });
      if (!handler) {
        return res.status(400).json({
          error: 'onErrorRunbookId does not point to a runbook in this tenant',
        });
      }
    }

    const runbook = await prisma.runbook.create({
      data: {
        name: data.name,
        description: data.description,
        nodes: data.nodes as unknown as Prisma.InputJsonValue,
        connections: data.connections as unknown as Prisma.InputJsonValue,
        inputs: (data.inputs ?? []) as unknown as Prisma.InputJsonValue,
        isActive: data.isActive || false,
        schedule: data.schedule,
        onErrorRunbookId: data.onErrorRunbookId ?? null,
        userId: req.user!.id,
        tenantId: req.user!.tenantId,
      },
    });

    // Freeze the initial definition as version 1 so any run dispatched
    // against this runbook can replay exactly these bytes.
    await safeCreateVersion(runbook.id, req.user!.id);

    if (data.schedule && data.isActive) {
      await prisma.scheduledJob.create({
        data: {
          runbookId: runbook.id,
          cronExpr: data.schedule,
          isActive: true,
          nextRunAt: computeNextRunAt(data.schedule),
        },
      });
    }

    await safeAuditWorkflow('runbook.created', {
      tenantId: req.user!.tenantId,
      actorId: req.user!.id,
      runbookId: runbook.id,
      payload: {
        runbookId: runbook.id,
        name: runbook.name,
        isActive: runbook.isActive,
        schedule: runbook.schedule ?? null,
        nodeCount: Array.isArray(data.nodes) ? data.nodes.length : 0,
        connectionCount: Array.isArray(data.connections) ? data.connections.length : 0,
      },
    });

    res.status(201).json(runbook);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    req.log.error({ error }, 'Create runbook error');
    res.status(500).json({ error: 'Failed to create runbook' });
  }
});

/**
 * @swagger
 * /workflows/{id}:
 *   put:
 *     summary: Update a runbook
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *               schedule: { type: string }
 *               nodes: { type: array, items: { type: object } }
 *               connections: { type: array, items: { type: object } }
 *           example:
 *             isActive: true
 *             schedule: "0 * * * *"
 *     responses:
 *       200:
 *         description: Workflow updated
 *         content:
 *           application/json:
 *             example:
 *               id: "wf-123"
 *               isActive: true
 *               schedule: "0 * * * *"
 *       404:
 *         description: Workflow not found
 */
/**
 * GET /workflows/:id/yaml
 *
 * Return the runbook in canonical YAML form. Used by the YAML view in
 * the editor and by the CLI/Git workflows that prefer text-based
 * runbook authoring.
 */
router.get('/:id/yaml', async (req: AuthRequest, res) => {
  try {
    const runbookId = req.params.id as string;
    const runbook = await prisma.runbook.findFirst({
      where: { id: runbookId, tenantId: req.user!.tenantId },
      include: {
        steps: true,
        stepConnections: true,
      },
    });
    if (!runbook) return res.status(404).json({ error: 'Runbook not found' });

    const spec = toSpec(
      {
        id: runbook.id,
        slug: runbook.slug,
        name: runbook.name,
        description: runbook.description,
        category: runbook.category,
        schedule: runbook.schedule,
      },
      runbook.steps.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        positionX: n.positionX,
        positionY: n.positionY,
        enabled: n.enabled,
        config: n.config,
      })),
      runbook.stepConnections.map(c => ({
        sourceNodeId: c.sourceNodeId,
        sourcePort: c.sourcePort,
        targetNodeId: c.targetNodeId,
        targetPort: c.targetPort,
      }))
    );

    const yamlText = specToYaml(spec);
    res.setHeader('Content-Type', 'application/x-yaml');
    res.send(yamlText);
  } catch (error) {
    req.log.error({ error }, 'Get runbook YAML error');
    res.status(500).json({ error: 'Failed to get runbook YAML' });
  }
});

/**
 * GET /runbooks/:id/versions
 *
 * Lists every persisted RunbookVersion for the given runbook, newest
 * first. Powers the "Compare versions" affordance in the editor — the
 * frontend picks two version ids and feeds them to the diff modal.
 *
 * Returns metadata only (id + version + createdAt + createdByUserId).
 * Snapshots are large; clients fetch them on demand via the per-id
 * route below.
 */
router.get('/:id/versions', async (req: AuthRequest, res) => {
  try {
    const runbookId = req.params.id as string;
    // Tenant scope check before listing versions — both the runbook
    // row AND the versions are tenant-scoped, but checking the runbook
    // first lets us return 404 for cross-tenant probes instead of an
    // empty list (which would leak existence).
    const runbook = await prisma.runbook.findFirst({
      where: { id: runbookId, tenantId: req.user!.tenantId },
      select: { id: true },
    });
    if (!runbook) return res.status(404).json({ error: 'Runbook not found' });

    const versions = await prisma.runbookVersion.findMany({
      where: { runbookId, tenantId: req.user!.tenantId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        createdAt: true,
        createdByUserId: true,
      },
    });
    return res.json({ data: versions });
  } catch (error) {
    req.log.error({ error }, 'List runbook versions error');
    return res.status(500).json({ error: 'Failed to list runbook versions' });
  }
});

/**
 * GET /runbooks/:id/versions/:versionId/yaml
 *
 * Renders a frozen RunbookVersion snapshot as YAML so the diff viewer
 * can feed two YAMLs straight into a text-diff component. Re-uses the
 * same toSpec / specToYaml pipeline as `/:id/yaml` so the byte-level
 * shape matches what the operator sees in YamlViewModal.
 *
 * Tenant scope is enforced via the version's own tenantId column —
 * cross-tenant requests get a 404 even if the versionId is guessed.
 */
router.get('/:id/versions/:versionId/yaml', async (req: AuthRequest, res) => {
  try {
    const runbookId = req.params.id as string;
    const versionId = req.params.versionId as string;
    const version = await prisma.runbookVersion.findFirst({
      where: { id: versionId, runbookId, tenantId: req.user!.tenantId },
      include: { runbook: { select: { slug: true } } },
    });
    if (!version) return res.status(404).json({ error: 'Version not found' });

    // The snapshot stores nodes + connections + name + description +
    // category as a JSON blob. We rebuild a Spec-shaped input for
    // toSpec — the schedule field doesn't live in the snapshot today
    // (it's a runbook-level field, not a per-version one), so we
    // pull it from the live runbook row.
    const snap = version.snapshot as {
      name?: string;
      description?: string | null;
      category?: string | null;
      nodes?: Array<Record<string, unknown>>;
      connections?: Array<Record<string, unknown>>;
    };
    const live = await prisma.runbook.findFirst({
      where: { id: runbookId, tenantId: req.user!.tenantId },
      select: { schedule: true },
    });
    const spec = toSpec(
      {
        id: runbookId,
        slug: version.runbook?.slug ?? null,
        name: snap.name ?? '',
        description: snap.description ?? null,
        category: snap.category ?? null,
        schedule: live?.schedule ?? null,
      },
      (snap.nodes ?? []).map(n => ({
        id: String(n.id),
        type: String(n.type ?? ''),
        title: typeof n.title === 'string' ? n.title : '',
        positionX: typeof n.positionX === 'number' ? n.positionX : 0,
        positionY: typeof n.positionY === 'number' ? n.positionY : 0,
        enabled: n.enabled !== false,
        config: (n.config ?? {}) as Record<string, unknown>,
      })),
      (snap.connections ?? []).map(c => ({
        sourceNodeId: String(c.sourceNodeId ?? ''),
        sourcePort: typeof c.sourcePort === 'number' ? c.sourcePort : null,
        targetNodeId: String(c.targetNodeId ?? ''),
        targetPort: typeof c.targetPort === 'number' ? c.targetPort : null,
      }))
    );
    const yamlText = specToYaml(spec);
    res.setHeader('Content-Type', 'application/x-yaml');
    return res.send(yamlText);
  } catch (error) {
    req.log.error({ error }, 'Get runbook version YAML error');
    return res.status(500).json({ error: 'Failed to get version YAML' });
  }
});

/**
 * PUT /workflows/:id/yaml
 *
 * Replace the runbook contents with a new YAML body. Performs a full
 * replace of nodes + connections within a transaction. Header fields
 * (name, slug, description, category, schedule) are also updated.
 *
 * This is intentionally a destructive replace, not a merge — the YAML
 * IS the source of truth when this endpoint is used. The visual editor
 * uses PUT /:id which preserves the row-level diff.
 */
router.put('/:id/yaml', async (req: AuthRequest, res) => {
  try {
    const runbookId = req.params.id as string;
    const yamlText = typeof req.body === 'string' ? req.body : (req.body?.yaml as string);
    if (!yamlText || typeof yamlText !== 'string') {
      return res.status(400).json({ error: 'Body must contain YAML text', code: 'missing_yaml' });
    }

    const existing = await prisma.runbook.findFirst({
      where: { id: runbookId, tenantId: req.user!.tenantId },
    });
    if (!existing) return res.status(404).json({ error: 'Runbook not found' });

    let parsed;
    try {
      const spec = yamlToSpec(yamlText);
      // Defence-in-depth: the editor already runs this validator
      // browser-side, but anyone with an API key can hit this route
      // directly. Run the same JSON Schema check here so a malformed
      // spec never lands in the database — the YAML route is a
      // destructive replace, not a merge, and a bad save here would
      // wipe the existing canvas.
      const schema = validateRunbookSpec(spec);
      if (!schema.valid) {
        return res.status(400).json({
          error: 'Runbook does not match the canonical schema',
          code: 'schema_invalid',
          details: schema.errors,
        });
      }
      parsed = fromSpec(spec);
    } catch (err) {
      if (err instanceof RunbookSerializerError) {
        return res.status(400).json({ error: err.message, code: err.code });
      }
      throw err;
    }

    const updated = await prisma.$transaction(async tx => {
      await tx.runbookConnection.deleteMany({ where: { runbookId } });
      await tx.runbookStep.deleteMany({ where: { runbookId } });

      await tx.runbook.update({
        where: { id: runbookId },
        data: {
          name: parsed.header.name,
          slug: parsed.header.slug,
          description: parsed.header.description,
          category: parsed.header.category,
          schedule: parsed.header.schedule,
        },
      });

      for (const node of parsed.nodes) {
        await tx.runbookStep.create({
          data: {
            id: node.id,
            runbookId,
            type: node.type,
            title: node.title,
            positionX: node.positionX,
            positionY: node.positionY,
            enabled: node.enabled,
            config: (node.config as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          },
        });
      }
      for (const conn of parsed.connections) {
        await tx.runbookConnection.create({
          data: {
            runbookId,
            sourceNodeId: conn.sourceNodeId,
            sourcePort: conn.sourcePort,
            targetNodeId: conn.targetNodeId,
            targetPort: conn.targetPort,
          },
        });
      }

      return tx.runbook.findFirst({
        where: { id: runbookId },
        include: { steps: true, stepConnections: true },
      });
    });

    res.json({
      id: updated!.id,
      name: updated!.name,
      slug: updated!.slug,
      updatedAt: updated!.updatedAt,
      stepCount: updated!.steps.length,
    });
  } catch (error) {
    req.log.error({ error }, 'Put runbook YAML error');
    res.status(500).json({ error: 'Failed to update runbook YAML' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    // Use partial schema for updates - only nodes and connections are required
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      nodes: z.array(workflowNodeSchema),
      connections: z.array(workflowConnectionSchema),
      isActive: z.boolean().optional(),
      schedule: z.string().optional(),
      version: z.string().optional(), // Allow version field from frontend
      lastModified: z.number().optional(), // Allow lastModified field from frontend
      // Error handler runbook id. `null` explicitly clears the
      // wiring; undefined leaves whatever was previously set.
      onErrorRunbookId: z.string().uuid().nullish(),
      inputs: z.array(runbookInputDefinitionSchema).optional(),
      // Step-id breakpoints. Persisted on the Runbook so the engine
      // can read them without an extra round-trip at execution time.
      // Frontend sends the full list every save; the engine just
      // checks `breakpoints.includes(currentNode.id)` before each
      // step's execute() call.
      breakpoints: z.array(z.string()).optional(),
    });

    const data = updateSchema.parse(req.body);
    const runbookId = req.params.id as string;

    const existing = await prisma.runbook.findFirst({
      where: {
        id: runbookId,
        tenantId: req.user!.tenantId,
      },
    });

    if (!existing) {
      // Special handling for the default 'current-runbook' (scratchpad)
      // If it doesn't exist, we create it instead of returning 404
      if (runbookId === 'current-runbook') {
        const newWorkflow = await prisma.runbook.create({
          data: {
            id: 'current-runbook',
            name: data.name || 'Untitled Workflow',
            description: data.description,
            nodes: data.nodes as unknown as Prisma.InputJsonValue,
            connections: data.connections as unknown as Prisma.InputJsonValue,
            isActive: data.isActive || false,
            schedule: data.schedule,
            userId: req.user!.id,
            tenantId: req.user!.tenantId,
          },
        });

        await safeCreateVersion(newWorkflow.id, req.user!.id);

        if (data.schedule && data.isActive) {
          await prisma.scheduledJob.create({
            data: {
              runbookId: newWorkflow.id,
              cronExpr: data.schedule,
              isActive: true,
              nextRunAt: computeNextRunAt(data.schedule),
            },
          });
        }

        await safeAuditWorkflow('runbook.created', {
          tenantId: req.user!.tenantId,
          actorId: req.user!.id,
          runbookId: newWorkflow.id,
          payload: {
            runbookId: newWorkflow.id,
            name: newWorkflow.name,
            isActive: newWorkflow.isActive,
            schedule: newWorkflow.schedule ?? null,
            scratchpad: true,
          },
        });

        return res.json({
          ...newWorkflow,
          timestamp: newWorkflow.updatedAt.getTime(),
        });
      }

      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Build update data object, only including fields that were provided.
    // Prisma.RunbookUpdateInput nests JSON columns and scalars behind
    // field-update operator unions that don't line up with the plain
    // reads we do below (updateData.name, .nodes, …). Keep this as a
    // narrow structural type so the reads stay simple while staying
    // away from `any`.
    const updateData: {
      nodes: Prisma.InputJsonValue;
      connections: Prisma.InputJsonValue;
      name?: string;
      description?: string;
      isActive?: boolean;
      schedule?: string | null;
      inputs?: Prisma.InputJsonValue;
      onErrorRunbookId?: string | null;
      breakpoints?: string[];
    } = {
      nodes: data.nodes as unknown as Prisma.InputJsonValue,
      connections: data.connections as unknown as Prisma.InputJsonValue,
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.schedule !== undefined) updateData.schedule = data.schedule;
    if (data.inputs !== undefined) {
      updateData.inputs = data.inputs as unknown as Prisma.InputJsonValue;
    }
    // Filter out breakpoints whose step ids no longer exist after this
    // save — the operator may have deleted a step that previously had
    // a breakpoint. The engine would just never trigger them, but
    // keeping the array clean avoids confusing post-mortem readers
    // and shrinks the column.
    if (data.breakpoints !== undefined) {
      const liveStepIds = new Set(data.nodes.map(n => n.id));
      updateData.breakpoints = data.breakpoints.filter(id => liveStepIds.has(id));
    }

    // onErrorRunbookId: undefined leaves it untouched, null clears,
    // uuid validates against same-tenant + not-self. Self-reference
    // is forbidden because it would immediately cycle on the first
    // failure and be caught at dispatch time — catching it here
    // gives the user a clearer error from the CRUD surface.
    if (data.onErrorRunbookId !== undefined) {
      if (data.onErrorRunbookId === null) {
        updateData.onErrorRunbookId = null;
      } else {
        if (data.onErrorRunbookId === runbookId) {
          return res.status(400).json({
            error: 'onErrorRunbookId cannot reference the runbook itself',
          });
        }
        const handler = await prisma.runbook.findFirst({
          where: { id: data.onErrorRunbookId, tenantId: req.user!.tenantId },
          select: { id: true },
        });
        if (!handler) {
          return res.status(400).json({
            error: 'onErrorRunbookId does not point to a runbook in this tenant',
          });
        }
        updateData.onErrorRunbookId = data.onErrorRunbookId;
      }
    }

    // Construct full runbook object for validation.
    // existing.{description,schedule} are nullable (Prisma `String?`),
    // but WorkflowDefinition only permits string | undefined — coerce
    // nulls to undefined at the boundary.
    const fullWorkflowForValidation: WorkflowDefinition = {
      name: updateData.name || existing.name,
      description: updateData.description ?? existing.description ?? undefined,
      nodes: (updateData.nodes || existing.nodes) as unknown as WorkflowNode[],
      connections: (updateData.connections ||
        existing.connections) as unknown as WorkflowConnection[],
      isActive: updateData.isActive ?? existing.isActive,
      schedule: updateData.schedule ?? existing.schedule ?? undefined,
    };

    const validator = new RunbookValidatorService();
    const validation = validator.validate(fullWorkflowForValidation);

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Workflow validation failed',
        issues: validation.issues,
      });
    }

    const runbook = await prisma.runbook.update({
      where: { id: runbookId },
      data: updateData,
    });

    if (updateChangedDefinition(updateData)) {
      await safeCreateVersion(runbook.id, req.user!.id);
    }

    await safeAuditWorkflow('runbook.updated', {
      tenantId: req.user!.tenantId,
      actorId: req.user!.id,
      runbookId: runbook.id,
      payload: {
        runbookId: runbook.id,
        name: runbook.name,
        isActive: runbook.isActive,
        schedule: runbook.schedule ?? null,
        changedFields: Object.keys(updateData),
        nodeCount: Array.isArray(data.nodes) ? data.nodes.length : 0,
        connectionCount: Array.isArray(data.connections) ? data.connections.length : 0,
      },
    });

    if (data.schedule) {
      const nextRunAt = computeNextRunAt(data.schedule);
      await prisma.scheduledJob.upsert({
        where: { runbookId: runbook.id },
        create: {
          runbookId: runbook.id,
          cronExpr: data.schedule,
          isActive: data.isActive || false,
          nextRunAt,
        },
        update: {
          cronExpr: data.schedule,
          isActive: data.isActive || false,
          nextRunAt,
        },
      });
    }

    res.json({
      ...runbook,
      timestamp: runbook.updatedAt.getTime(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      req.log.error({ error: error.errors }, 'Validation error');
      return res.status(400).json({ error: error.errors });
    }
    req.log.error({ error }, 'Update runbook error');
    res.status(500).json({ error: 'Failed to update runbook' });
  }
});

/**
 * Dedicated write path for the typed input declarations so the inputs
 * form can persist without piggybacking on the canvas autosave
 * (which prefers the YAML round-trip and doesn't carry inputs yet).
 * Replaces the whole inputs array — the client sends the full list
 * on every change, which matches how the panel is edited.
 */
router.put('/:id/inputs', async (req: AuthRequest, res) => {
  try {
    const runbookId = req.params.id as string;
    const inputs = z.array(runbookInputDefinitionSchema).parse(req.body?.inputs ?? []);

    const existing = await prisma.runbook.findFirst({
      where: { id: runbookId, tenantId: req.user!.tenantId },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const updated = await prisma.runbook.update({
      where: { id: runbookId },
      data: { inputs: inputs as unknown as Prisma.InputJsonValue },
      select: { id: true, inputs: true, updatedAt: true },
    });

    // Inputs are part of the frozen definition (the Run dialog form
    // is derived from them), so a change here deserves a new version.
    await safeCreateVersion(updated.id, req.user!.id);

    res.json({ ...updated, timestamp: updated.updatedAt.getTime() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    req.log.error({ error }, 'Update runbook inputs error');
    res.status(500).json({ error: 'Failed to update runbook inputs' });
  }
});

/**
 * @swagger
 * /workflows/{id}:
 *   delete:
 *     summary: Delete a runbook
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Workflow deleted
 *       404:
 *         description: Workflow not found
 */
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const runbookId = req.params.id as string;
    const existing = await prisma.runbook.findFirst({
      where: {
        id: runbookId,
        tenantId: req.user!.tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    await prisma.scheduledJob.deleteMany({
      where: { runbookId },
    });

    await prisma.runbook.delete({
      where: { id: runbookId },
    });

    await safeAuditWorkflow('runbook.deleted', {
      tenantId: req.user!.tenantId,
      actorId: req.user!.id,
      runbookId,
      payload: {
        runbookId,
        name: existing.name,
      },
    });

    res.status(204).send();
  } catch (error) {
    req.log.error({ error }, 'Delete runbook error');
    res.status(500).json({ error: 'Failed to delete runbook' });
  }
});

/**
 * @swagger
 * /workflows/{id}/duplicate:
 *   post:
 *     summary: Duplicate a runbook
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Workflow duplicated
 *         content:
 *           application/json:
 *             example:
 *               id: "wf-copy-456"
 *               name: "Original Name (Copy)"
 *               nodes: []
 *       404:
 *         description: Workflow not found
 */
router.post('/:id/duplicate', async (req: AuthRequest, res) => {
  try {
    const runbookId = req.params.id as string;
    const existing = await prisma.runbook.findFirst({
      where: {
        id: runbookId,
        tenantId: req.user!.tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Cast Prisma JSON fields for the duplicate
    const runbook = await prisma.runbook.create({
      data: {
        name: `${existing.name} (Copy)`,
        description: existing.description,
        nodes: existing.nodes as Prisma.InputJsonValue,
        connections: existing.connections as Prisma.InputJsonValue,
        isActive: false,
        userId: req.user!.id,
        tenantId: req.user!.tenantId,
      },
    });

    await safeCreateVersion(runbook.id, req.user!.id);

    await safeAuditWorkflow('runbook.created', {
      tenantId: req.user!.tenantId,
      actorId: req.user!.id,
      runbookId: runbook.id,
      payload: {
        runbookId: runbook.id,
        name: runbook.name,
        duplicatedFrom: existing.id,
      },
    });

    res.status(201).json(runbook);
  } catch (error) {
    req.log.error({ error }, 'Duplicate runbook error');
    res.status(500).json({ error: 'Failed to duplicate runbook' });
  }
});

export default router;
