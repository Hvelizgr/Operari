import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../server';
import { AuthRequest } from '../middleware/auth.middleware';
import { EventAgentService } from '../agent/services/event-agent.service';

const router = Router();

let _service: EventAgentService | null = null;
function getService() {
    if (!_service) _service = new EventAgentService(prisma);
    return _service;
}

// Anonymous fallback for dev / single-tenant self-host. Same pattern as
// /api/runs and /api/dashboard. The v1 API surface (when added) will
// require an explicit `event_agents:write` scope.
router.use((req: AuthRequest, _res, next) => {
    if (!req.user) {
        req.user = {
            id: 'anonymous',
            email: 'anonymous@nanoflow.local',
            role: 'USER',
            tenantId: 'default-tenant',
        };
    }
    next();
});

const matcherTypeEnum = z.enum(['jsonpath', 'llm', 'always']);

const createSchema = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    source: z.string().min(1).max(40),
    webhookId: z.string().nullable().optional(),
    matcherType: matcherTypeEnum,
    matcherConfig: z.unknown(),
    targetRunbookId: z.string().min(1),
    varMapping: z.record(z.string(), z.string()),
    isEnabled: z.boolean().optional(),
    rateLimitPerHour: z.number().int().min(1).max(1000).optional(),
});

const updateSchema = createSchema.partial();

const testSchema = z.object({
    matcherType: matcherTypeEnum,
    matcherConfig: z.unknown(),
    varMapping: z.record(z.string(), z.string()),
    payload: z.unknown(),
});

router.get('/', async (req: AuthRequest, res: Response) => {
    const agents = await getService().list(req.user!.tenantId);
    res.json({ data: agents });
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
    const agent = await getService().get(req.user!.tenantId, String(req.params.id));
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
});

router.get('/:id/executions', async (req: AuthRequest, res: Response) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const executions = await getService().listExecutions(
        req.user!.tenantId,
        String(req.params.id),
        limit,
    );
    res.json({ data: executions });
});

router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const body = createSchema.parse(req.body);
        const agent = await getService().create(req.user!.tenantId, {
            ...body,
            matcherConfig: body.matcherConfig as any,
            varMapping: body.varMapping as any,
        });
        res.status(201).json(agent);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid agent', details: err.errors });
        }
        res.status(400).json({
            error: err instanceof Error ? err.message : 'Failed to create agent',
        });
    }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const body = updateSchema.parse(req.body);
        const agent = await getService().update(
            req.user!.tenantId,
            String(req.params.id),
            {
                ...body,
                matcherConfig: body.matcherConfig as any,
                varMapping: body.varMapping as any,
            },
        );
        if (!agent) return res.status(404).json({ error: 'Agent not found' });
        res.json(agent);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid agent', details: err.errors });
        }
        res.status(400).json({
            error: err instanceof Error ? err.message : 'Failed to update agent',
        });
    }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
    const agent = await getService().delete(req.user!.tenantId, String(req.params.id));
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ deleted: true, id: agent.id });
});

/**
 * POST /api/event-agents/test
 *
 * Run a matcher + var mapping against a payload WITHOUT persisting or
 * triggering anything. Powers the "test this agent" button in the UI:
 * the operator pastes a sample webhook payload and instantly sees
 * matched / vars / reason.
 */
router.post('/test', async (req: AuthRequest, res: Response) => {
    try {
        const { matcherType, matcherConfig, varMapping, payload } = testSchema.parse(req.body);
        const result = getService().match(matcherType, matcherConfig, varMapping, payload);
        res.json(result);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid test request', details: err.errors });
        }
        res.status(500).json({ error: 'Test failed' });
    }
});

export default router;
