import { Router } from 'express';

import { AuditService } from '../audit/audit.service';
import { ExecutionService } from '../editor/execution/execution.service';
import { anonymousFallback, authenticate, AuthRequest } from '../middleware/auth.middleware';
import { ExecutionEventStore } from '../runbook/engine/execution-event.store';
import { getRunner } from '../runbook/runners';
import { prisma } from '../server';

let auditService: AuditService | null = null;
function getAudit(): AuditService {
  if (!auditService) auditService = new AuditService(prisma);
  return auditService;
}

let eventStore: ExecutionEventStore | null = null;
/**
 * Returns the durable execution event store instance, or null when
 * the durable engine is not enabled. The check matches the same env
 * flag that ExecutionService uses so the cancel route does not
 * write to the store unless the rest of the engine is too.
 */
function getEventStore(): ExecutionEventStore | null {
  if (process.env.NANORUN_DURABLE_ENGINE !== 'true') return null;
  if (!eventStore) eventStore = new ExecutionEventStore(prisma);
  return eventStore;
}

const router = Router();

// Anonymous fallback gated by NANORUN_ANONYMOUS_MODE=true.
router.use(anonymousFallback);

/**
 * @swagger
 * /executions:
 *   get:
 *     summary: List executions
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: workflowId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [RUNNING, COMPLETED, FAILED, CANCELLED] }
 *     responses:
 *       200:
 *         description: List of executions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 executions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       status: { type: string }
 *                       startedAt: { type: string }
 *                       duration: { type: number }
 *                 pagination:
 *                   type: object
 *             example:
 *               executions:
 *                 - id: "exec-1"
 *                   workflowId: "wf-1"
 *                   status: "COMPLETED"
 *                   startedAt: "2024-03-20T10:00:00Z"
 *                   duration: 1500
 *               pagination:
 *                 page: 1
 *                 limit: 20
 *                 total: 50
 *                 pages: 3
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page = '1', limit = '20', workflowId, status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where = {
      workflow: { tenantId: req.user!.tenantId },
      ...(workflowId && { workflowId: workflowId as string }),
      ...(status && { status: status as any }),
    };

    const [executions, total] = await Promise.all([
      prisma.execution.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { startedAt: 'desc' },
        include: {
          workflow: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { nodeLogs: true } },
        },
      }),
      prisma.execution.count({ where }),
    ]);

    res.json({
      executions,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    req.log.error({ error }, 'Get executions error');
    res.status(500).json({ error: 'Failed to get executions' });
  }
});

/**
 * @swagger
 * /executions/{id}:
 *   get:
 *     summary: Get execution details
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Execution details
 *         content:
 *           application/json:
 *             example:
 *               id: "exec-1"
 *               workflowId: "wf-1"
 *               status: "FAILED"
 *               error: "HTTP 500"
 *               startedAt: "2024-03-20T10:00:00Z"
 *               completedAt: "2024-03-20T10:00:02Z"
 *               nodeLogs:
 *                 - nodeId: "node-1"
 *                   status: "SUCCESS"
 *                   duration: 200
 *                 - nodeId: "node-2"
 *                   status: "ERROR"
 *                   duration: 50
 *                   error: "Connection timeout"
 *       404:
 *         description: Execution not found
 *         content:
 *           application/json:
 *             example:
 *               error: "Execution not found"
 */
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const executionId = req.params.id as string;
    const execution = await prisma.execution.findFirst({
      where: {
        id: executionId,
        workflow: { tenantId: req.user!.tenantId },
      },
      include: {
        workflow: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        nodeLogs: { orderBy: { startedAt: 'asc' } },
      },
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json(execution);
  } catch (error) {
    req.log.error({ error }, 'Get execution error');
    res.status(500).json({ error: 'Failed to get execution' });
  }
});

/**
 * @swagger
 * /executions/{workflowId}/run:
 *   post:
 *     summary: Trigger manual execution
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 type: object
 *                 description: Initial input data for the workflow
 *           example:
 *             input:
 *               email: "user@example.com"
 *               sku: "PROD-123"
 *     responses:
 *       202:
 *         description: Execution started
 *         content:
 *           application/json:
 *             example:
 *               id: "exec-new-123"
 *               status: "RUNNING"
 *               trigger: "MANUAL"
 *       404:
 *         description: Workflow not found
 *         content:
 *           application/json:
 *             example:
 *               error: "Workflow not found"
 */
/**
 * @swagger
 * /executions/{id}/logs:
 *   get:
 *     summary: Replay logs for an execution from the durable Redis Streams log
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns up to `count` log entries for the execution starting at
 *       the cursor `fromId` (use `-` for the beginning, or the id from
 *       the previous page to continue). Backed by the per-execution
 *       Redis Stream `runs:{id}:logs`. Empty array when Redis is not
 *       configured or the stream has no entries.
 *
 *       Use this endpoint to backfill the live log view when a websocket
 *       client reconnects mid-run, or to replay a finished run for
 *       debugging.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: fromId
 *         schema: { type: string, default: '-' }
 *       - in: query
 *         name: count
 *         schema: { type: integer, default: 1000, minimum: 1, maximum: 10000 }
 *     responses:
 *       200:
 *         description: Array of log entries
 */
router.get('/:id/logs', async (req: AuthRequest, res) => {
  try {
    const executionId = req.params.id as string;
    // Tenant guard: confirm the execution belongs to the caller's
    // tenant before exposing its logs. The Redis stream itself is
    // not tenant-scoped (key is per executionId) so this check is
    // the only thing protecting cross-tenant log reads.
    const execution = await prisma.execution.findFirst({
      where: {
        id: executionId,
        workflow: { tenantId: req.user!.tenantId },
      },
      select: { id: true },
    });
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    const fromId = (req.query.fromId as string | undefined) ?? '-';
    const countParam = req.query.count as string | undefined;
    let count = countParam ? parseInt(countParam, 10) : 1000;
    if (!Number.isFinite(count) || count < 1) count = 1000;
    if (count > 10000) count = 10000;

    const { getLogStream } = require('../observability/log-stream.service');
    const entries = await getLogStream().fetch(executionId, { fromId, count });
    const total = await getLogStream().length(executionId);

    return res.json({
      executionId,
      entries,
      count: entries.length,
      totalApprox: total,
      nextFromId: entries.length > 0 ? entries[entries.length - 1].id : null,
    });
  } catch (error) {
    req.log.error({ error }, 'Fetch logs error');
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

router.post('/:workflowId/run', async (req: AuthRequest, res) => {
  try {
    const workflowId = req.params.workflowId as string;
    const workflow = await prisma.runbook.findFirst({
      where: {
        id: workflowId,
        tenantId: req.user!.tenantId,
      },
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const executionService = new ExecutionService(prisma);
    const execution = await executionService.execute({
      workflowId: workflow.id,
      userId: req.user!.id,
      tenantId: req.user!.tenantId,
      trigger: 'MANUAL',
      input: req.body.input || {},
      // Dry-run is strictly opt-in per request. The body flag
      // must be literally `true` so there's no way to trigger
      // a dry run by accident from an incorrectly-typed form.
      dryRun: req.body.dryRun === true,
    });

    res.status(202).json(execution);
  } catch (error) {
    req.log.error({ error }, 'Run workflow error');
    res.status(500).json({ error: 'Failed to run workflow' });
  }
});

/**
 * @swagger
 * /executions/{id}/cancel:
 *   post:
 *     summary: Cancel a running execution
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Execution cancelled
 *         content:
 *           application/json:
 *             example:
 *               message: "Execution cancelled"
 *       404:
 *         description: Execution not found or not running
 *         content:
 *           application/json:
 *             example:
 *               error: "Running execution not found"
 */
router.post('/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const executionId = req.params.id as string;
    const execution = await prisma.execution.findFirst({
      where: {
        id: executionId,
        workflow: { tenantId: req.user!.tenantId },
        status: 'RUNNING',
      },
    });

    if (!execution) {
      return res.status(404).json({ error: 'Running execution not found' });
    }

    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    // Signal the runner to actually stop in-flight work. Without this
    // the DB row says CANCELLED but the docker container or fly
    // machine keeps burning compute until its own timeout. Best-effort
    // — a runner that does not implement cancel() (or fails) leaves
    // an "orphan" run that will time out on its own.
    let signalledProcesses = 0;
    try {
      const runner = getRunner();
      if (runner.cancel) {
        signalledProcesses = await runner.cancel(executionId);
      }
    } catch (runnerErr) {
      req.log.error(
        { err: runnerErr },
        'runner.cancel failed; DB row is CANCELLED but in-flight work may continue'
      );
    }

    // Audit: tamper-evident record of the cancel. Fire-and-forget so a
    // broken audit chain never blocks the operator's ability to stop a
    // run. See docs/audit-event-coverage.md.
    try {
      await getAudit().record({
        tenantId: req.user!.tenantId,
        type: 'run.cancelled',
        actorId: req.user!.id,
        actorType: 'user',
        resource: executionId,
        payload: {
          executionId,
          workflowId: execution.workflowId,
          cancelledAt: new Date().toISOString(),
          signalledProcesses,
        },
      });
    } catch (auditErr) {
      req.log.error({ err: auditErr }, 'audit write failed for run.cancelled');
    }

    // Durable engine (ADR 0003): mirror the cancel into the event
    // store so the resume worker sees the run as terminal on the
    // next backend restart. Best-effort, never blocks the response.
    const store = getEventStore();
    if (store) {
      try {
        await store.append(executionId, req.user!.tenantId, {
          type: 'run.cancelled',
          payload: {
            cancelledByActorId: req.user!.id,
            cancelledAt: new Date().toISOString(),
            signalledProcesses,
          },
        });
      } catch (eventErr) {
        req.log.error({ err: eventErr }, 'execution event store write failed for run.cancelled');
      }
    }

    res.json({ message: 'Execution cancelled' });
  } catch (error) {
    req.log.error({ error }, 'Cancel execution error');
    res.status(500).json({ error: 'Failed to cancel execution' });
  }
});

/**
 * @swagger
 * /executions/{id}/replay:
 *   post:
 *     summary: Replay an execution from a specific node
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nodeId:
 *                 type: string
 *                 description: ID of the node to start replay from
 *     responses:
 *       202:
 *         description: Replay started
 *       404:
 *         description: Execution or node log not found
 */
router.post('/:id/replay', async (req: AuthRequest, res) => {
  try {
    const executionId = req.params.id as string;
    const { nodeId } = req.body;

    const executionService = new ExecutionService(prisma);
    const newExecution = await executionService.replayExecution({
      executionId,
      nodeId,
      userId: req.user!.id,
      tenantId: req.user!.tenantId,
    });

    res.status(202).json(newExecution);
  } catch (error: any) {
    req.log.error({ error }, 'Replay execution error');
    res.status(error.status || 500).json({ error: error.message || 'Failed to replay execution' });
  }
});

/**
 * @swagger
 * /executions/{id}/resume:
 *   post:
 *     summary: Resume a paused execution
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 type: object
 *                 description: Optional input data to merge for the resumed execution
 *     responses:
 *       200:
 *         description: Execution resumed
 *       404:
 *         description: Paused execution not found
 */
router.post('/:id/resume', async (req: AuthRequest, res) => {
  try {
    const executionId = req.params.id as string;
    const input = req.body.input || {};

    const executionService = new ExecutionService(prisma);
    const execution = await executionService.resumeExecution({
      executionId,
      userId: req.user!.id,
      tenantId: req.user!.tenantId,
      input,
    });

    res.status(200).json(execution);
  } catch (error: any) {
    req.log.error({ error }, 'Resume execution error');
    res.status(error.status || 500).json({ error: error.message || 'Failed to resume execution' });
  }
});

export default router;
