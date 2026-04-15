/**
 * Tests that ExecutionService emits to the billing meter at run start
 * and run completion (P1 #12 wiring). Same shape as the event-store
 * wiring tests: recording fake meter, mocked Prisma, no real Stripe.
 */

import { PrismaClient, TriggerType } from '@prisma/client';
import { ExecutionService } from '../../editor/execution/execution.service';
import type { BillableEvent, BillingMeter } from '../../billing';

// Mock NodeExecutor so its execute() returns an empty object instead
// of undefined. The auto-mock returns undefined for every method,
// which trips runWorkflow's `(output as SuspendResult).isSuspended`
// check on the very first node and routes the run to the failure
// branch — which is correct for the failure-path test but masks the
// success-path test.
jest.mock('../../editor/node-executor.service', () => ({
    NodeExecutor: jest.fn().mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue({}),
    })),
}));
jest.mock('../../services/error-notification.service');
jest.mock('../../services/logger.service', () => ({
    Logger: {
        getInstance: jest.fn().mockReturnValue({
            child: jest.fn().mockReturnValue({
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
                debug: jest.fn(),
            }),
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        }),
    },
}));
jest.mock('../../utils/error-persistence');

interface RecordedMeterCall {
    type: BillableEvent['type'];
    customerId?: string;
    value: number;
    idempotencyKey?: string;
    metadata?: Record<string, string>;
}

function buildRecordingMeter(): { meter: BillingMeter; calls: RecordedMeterCall[] } {
    const calls: RecordedMeterCall[] = [];
    const meter: BillingMeter = {
        name: 'recording',
        record: jest.fn(async (event: BillableEvent) => {
            calls.push({
                type: event.type,
                customerId: event.customerId,
                value: event.value,
                idempotencyKey: event.idempotencyKey,
                metadata: event.metadata,
            });
            return true;
        }),
    };
    return { meter, calls };
}

const buildPrisma = (overrides: { stripeCustomerId?: string | null } = {}) => ({
    runbook: {
        findUnique: jest.fn(),
    },
    execution: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
    },
    nodeLog: {
        create: jest.fn(),
        update: jest.fn(),
    },
    executionError: {
        findFirst: jest.fn(),
    },
    tenant: {
        findUnique: jest.fn(async () => ({
            stripeCustomerId: overrides.stripeCustomerId ?? null,
        })),
    },
}) as unknown as PrismaClient;

const baseExecuteParams = {
    workflowId: 'wf-1',
    userId: 'user-1',
    trigger: TriggerType.MANUAL,
    tenantId: 'tenant-1',
};

describe('ExecutionService billing meter wiring (p1 #12)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('records run.started with the resolved Stripe customer id', async () => {
        const prisma = buildPrisma({ stripeCustomerId: 'cus_acme' });
        (prisma.runbook.findUnique as jest.Mock).mockResolvedValue({
            id: 'wf-1', name: 'Deploy', nodes: [], connections: [],
        });
        (prisma.execution.create as jest.Mock).mockResolvedValue({
            id: 'exec-1', workflowId: 'wf-1', userId: 'user-1', status: 'RUNNING', trigger: 'MANUAL',
        });

        const { meter, calls } = buildRecordingMeter();
        const svc = new ExecutionService(prisma, {
            audit: null, tracer: null, eventStore: null, meter,
        });

        await svc.execute(baseExecuteParams);
        await new Promise((resolve) => setImmediate(resolve));

        const startedCall = calls.find((c) => c.type === 'run.started');
        expect(startedCall).toBeDefined();
        expect(startedCall!.customerId).toBe('cus_acme');
        expect(startedCall!.value).toBe(1);
        expect(startedCall!.idempotencyKey).toBe('run.started:exec-1');
        expect(startedCall!.metadata).toMatchObject({
            executionId: 'exec-1',
            tenantId: 'tenant-1',
        });
    });

    it('records run.completed after a successful run finishes', async () => {
        // ExecutionService.runWorkflow rejects an empty workflow with
        // WORKFLOW_INVALID, so we have to give it at least one node.
        // We mock NodeExecutor (jest.mock at the top of this file),
        // so the node implementation does not need to do real work —
        // execute() is auto-mocked to return undefined which the
        // engine treats as a passthrough output.
        const prisma = buildPrisma({ stripeCustomerId: 'cus_acme' });
        (prisma.runbook.findUnique as jest.Mock).mockResolvedValue({
            id: 'wf-1',
            name: 'Deploy',
            nodes: [{ id: 'n-1', type: 'Trigger', title: 'Start', position: { x: 0, y: 0 }, config: {} }],
            connections: [],
        });
        (prisma.execution.create as jest.Mock).mockResolvedValue({
            id: 'exec-1', workflowId: 'wf-1', userId: 'user-1', status: 'RUNNING', trigger: 'MANUAL',
        });
        (prisma.nodeLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });
        (prisma.nodeLog.update as jest.Mock).mockResolvedValue({});
        (prisma.execution.update as jest.Mock).mockResolvedValue({});

        const { meter, calls } = buildRecordingMeter();
        const svc = new ExecutionService(prisma, {
            audit: null, tracer: null, eventStore: null, meter,
        });

        await svc.execute(baseExecuteParams);
        // runWorkflow is fire-and-forget from execute(), drain microtasks
        // until the run.completed call shows up.
        for (let i = 0; i < 100 && !calls.some((c) => c.type === 'run.completed'); i++) {
            await new Promise((resolve) => setImmediate(resolve));
        }

        const completedCall = calls.find((c) => c.idempotencyKey === 'run.completed:exec-1');
        expect(completedCall).toBeDefined();
        expect(completedCall!.customerId).toBe('cus_acme');
        expect(completedCall!.type).toBe('run.completed');
    });

    it('records the failure path as a billable run.completed (failed runs still consumed resources)', async () => {
        // Empty workflow → WORKFLOW_INVALID → run.failed branch.
        // safeMeter maps run.failed → run.completed at the billing
        // layer so the customer is still billed for the resources
        // the failed run consumed (a deliberate business decision
        // documented in the commit message and the safeMeter comment).
        const prisma = buildPrisma({ stripeCustomerId: 'cus_acme' });
        (prisma.runbook.findUnique as jest.Mock).mockResolvedValue({
            id: 'wf-1', name: 'Deploy', nodes: [], connections: [],
        });
        (prisma.execution.create as jest.Mock).mockResolvedValue({
            id: 'exec-1', workflowId: 'wf-1', userId: 'user-1', status: 'RUNNING', trigger: 'MANUAL',
        });
        (prisma.execution.update as jest.Mock).mockResolvedValue({});

        const { meter, calls } = buildRecordingMeter();
        const svc = new ExecutionService(prisma, {
            audit: null, tracer: null, eventStore: null, meter,
        });

        await svc.execute(baseExecuteParams);
        for (let i = 0; i < 100 && !calls.some((c) => c.idempotencyKey === 'run.failed:exec-1'); i++) {
            await new Promise((resolve) => setImmediate(resolve));
        }

        // safeMeter rewrites the type to 'run.completed' but preserves
        // 'run.failed' in the idempotency key so dashboards can
        // distinguish billable-but-failed runs from billable success.
        const failedCall = calls.find((c) => c.idempotencyKey === 'run.failed:exec-1');
        expect(failedCall).toBeDefined();
        expect(failedCall!.type).toBe('run.completed');
        expect(failedCall!.customerId).toBe('cus_acme');
    });

    it('passes undefined customerId when the tenant has no Stripe link (no-op path)', async () => {
        const prisma = buildPrisma({ stripeCustomerId: null });
        (prisma.runbook.findUnique as jest.Mock).mockResolvedValue({
            id: 'wf-1', name: 'Deploy', nodes: [], connections: [],
        });
        (prisma.execution.create as jest.Mock).mockResolvedValue({
            id: 'exec-1', workflowId: 'wf-1', userId: 'user-1', status: 'RUNNING', trigger: 'MANUAL',
        });

        const { meter, calls } = buildRecordingMeter();
        const svc = new ExecutionService(prisma, {
            audit: null, tracer: null, eventStore: null, meter,
        });

        await svc.execute(baseExecuteParams);
        await new Promise((resolve) => setImmediate(resolve));

        // The runtime still calls meter.record (so the meter sees the
        // event). It's the meter's job to no-op on missing customerId,
        // not the runtime's job to skip.
        const startedCall = calls.find((c) => c.type === 'run.started');
        expect(startedCall).toBeDefined();
        expect(startedCall!.customerId).toBeUndefined();
    });

    it('does not call the meter when meter=null is passed (explicit disable)', async () => {
        const prisma = buildPrisma({ stripeCustomerId: 'cus_acme' });
        (prisma.runbook.findUnique as jest.Mock).mockResolvedValue({
            id: 'wf-1', name: 'Deploy', nodes: [], connections: [],
        });
        (prisma.execution.create as jest.Mock).mockResolvedValue({
            id: 'exec-1', workflowId: 'wf-1', userId: 'user-1', status: 'RUNNING', trigger: 'MANUAL',
        });

        const { meter, calls } = buildRecordingMeter();
        const svc = new ExecutionService(prisma, {
            audit: null, tracer: null, eventStore: null, meter: null,
        });

        await svc.execute(baseExecuteParams);
        await new Promise((resolve) => setImmediate(resolve));

        // The fake meter object exists but ExecutionService never sees it
        expect(meter.record).not.toHaveBeenCalled();
        expect(calls).toEqual([]);
    });

    it('skips meter calls silently when tenantId is missing', async () => {
        const prisma = buildPrisma();
        (prisma.runbook.findUnique as jest.Mock).mockResolvedValue({
            id: 'wf-1', name: 'Deploy', nodes: [], connections: [],
        });
        (prisma.execution.create as jest.Mock).mockResolvedValue({
            id: 'exec-1', workflowId: 'wf-1', userId: 'user-1', status: 'RUNNING', trigger: 'MANUAL',
        });

        const { meter, calls } = buildRecordingMeter();
        const svc = new ExecutionService(prisma, {
            audit: null, tracer: null, eventStore: null, meter,
        });

        // Call without tenantId on purpose — the runtime should skip
        // billing because it has no tenant to attribute the event to.
        await svc.execute({
            workflowId: 'wf-1',
            userId: 'user-1',
            trigger: TriggerType.MANUAL,
        });
        await new Promise((resolve) => setImmediate(resolve));

        expect(calls).toEqual([]);
    });

    it('does not crash execute() when the meter throws on record', async () => {
        const prisma = buildPrisma({ stripeCustomerId: 'cus_acme' });
        (prisma.runbook.findUnique as jest.Mock).mockResolvedValue({
            id: 'wf-1', name: 'Deploy', nodes: [], connections: [],
        });
        (prisma.execution.create as jest.Mock).mockResolvedValue({
            id: 'exec-1', workflowId: 'wf-1', userId: 'user-1', status: 'RUNNING', trigger: 'MANUAL',
        });

        const flakyMeter: BillingMeter = {
            name: 'flaky',
            record: jest.fn().mockRejectedValue(new Error('stripe down')),
        };

        const svc = new ExecutionService(prisma, {
            audit: null, tracer: null, eventStore: null, meter: flakyMeter,
        });

        // Must not throw — billing must never block a real execution
        await expect(svc.execute(baseExecuteParams)).resolves.toBeDefined();
    });
});
