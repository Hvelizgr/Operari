/**
 * Tests that ExecutionService emits to the durable event store at the
 * same lifecycle points it emits to the audit chain (ADR 0003 phase 2).
 *
 * Uses a recording fake event store so the assertions pin the
 * variant + payload contract without standing up Postgres.
 */

import { PrismaClient, TriggerType } from '@prisma/client';
import { ExecutionService } from '../../editor/execution/execution.service';
import type { ExecutionEventStore } from '../../runbook/engine/execution-event.store';
import type { ExecutionEventPayload } from '../../runbook/engine/execution-event.types';

jest.mock('../../editor/node-executor.service');
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

interface RecordedEvent {
    executionId: string;
    tenantId: string;
    type: string;
    nodeId?: string;
}

function buildRecordingEventStore(): {
    store: ExecutionEventStore;
    events: RecordedEvent[];
} {
    const events: RecordedEvent[] = [];
    const store = {
        append: jest.fn(async (
            executionId: string,
            tenantId: string,
            event: ExecutionEventPayload,
        ) => {
            events.push({
                executionId,
                tenantId,
                type: event.type,
                nodeId: event.nodeId,
            });
            return {} as never;
        }),
    } as unknown as ExecutionEventStore;
    return { store, events };
}

const mockPrisma = {
    workflow: {
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
} as unknown as PrismaClient;

describe('ExecutionService event store wiring (ADR 0003 phase 2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('emits run.created and run.started in order on execute()', async () => {
        (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
            id: 'wf-1',
            name: 'Deploy',
            nodes: [],
            connections: [],
        });
        (mockPrisma.execution.create as jest.Mock).mockResolvedValue({
            id: 'exec-1',
            workflowId: 'wf-1',
            userId: 'user-1',
            status: 'RUNNING',
            trigger: 'MANUAL',
        });

        const { store, events } = buildRecordingEventStore();
        const svc = new ExecutionService(mockPrisma, {
            audit: null,
            tracer: null,
            eventStore: store,
        });

        await svc.execute({
            workflowId: 'wf-1',
            userId: 'user-1',
            trigger: TriggerType.MANUAL,
            tenantId: 'tenant-1',
        });

        // Yield to let the async runWorkflow fire-and-forget land its events
        await new Promise((resolve) => setImmediate(resolve));

        const types = events.map((e) => e.type);
        // The first two events must be run.created then run.started, in that
        // order. The runWorkflow loop adds run.completed asynchronously after
        // the empty workflow finishes.
        expect(types[0]).toBe('run.created');
        expect(types[1]).toBe('run.started');
        expect(events[0].tenantId).toBe('tenant-1');
        expect(events[0].executionId).toBe('exec-1');
    });

    it('does not emit anything when eventStore is null (default with flag off)', async () => {
        (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
            id: 'wf-1',
            name: 'Deploy',
            nodes: [],
            connections: [],
        });
        (mockPrisma.execution.create as jest.Mock).mockResolvedValue({
            id: 'exec-1',
            workflowId: 'wf-1',
            userId: 'user-1',
            status: 'RUNNING',
            trigger: 'MANUAL',
        });

        const { store, events } = buildRecordingEventStore();
        // Pass null explicitly — this is how a test (or NANORUN_DURABLE_ENGINE
        // unset) disables the wiring even though a store instance exists.
        const svc = new ExecutionService(mockPrisma, {
            audit: null,
            tracer: null,
            eventStore: null,
        });

        await svc.execute({
            workflowId: 'wf-1',
            userId: 'user-1',
            trigger: TriggerType.MANUAL,
            tenantId: 'tenant-1',
        });
        await new Promise((resolve) => setImmediate(resolve));

        // The store object is not the one ExecutionService is using
        expect(store.append).not.toHaveBeenCalled();
        expect(events).toHaveLength(0);
    });

    it('skips emission silently when tenantId is missing', async () => {
        (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
            id: 'wf-1',
            name: 'Deploy',
            nodes: [],
            connections: [],
        });
        (mockPrisma.execution.create as jest.Mock).mockResolvedValue({
            id: 'exec-1',
            workflowId: 'wf-1',
            userId: 'user-1',
            status: 'RUNNING',
            trigger: 'MANUAL',
        });

        const { store, events } = buildRecordingEventStore();
        const svc = new ExecutionService(mockPrisma, {
            audit: null,
            tracer: null,
            eventStore: store,
        });

        await svc.execute({
            workflowId: 'wf-1',
            userId: 'user-1',
            trigger: TriggerType.MANUAL,
            // tenantId omitted on purpose
        });
        await new Promise((resolve) => setImmediate(resolve));

        // Skipping is silent — no events recorded, no throw
        expect(events).toHaveLength(0);
    });

    it('does not crash execute() when the event store throws on append', async () => {
        (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue({
            id: 'wf-1',
            name: 'Deploy',
            nodes: [],
            connections: [],
        });
        (mockPrisma.execution.create as jest.Mock).mockResolvedValue({
            id: 'exec-1',
            workflowId: 'wf-1',
            userId: 'user-1',
            status: 'RUNNING',
            trigger: 'MANUAL',
        });

        const flakyStore = {
            append: jest.fn().mockRejectedValue(new Error('postgres down')),
        } as unknown as ExecutionEventStore;

        const svc = new ExecutionService(mockPrisma, {
            audit: null,
            tracer: null,
            eventStore: flakyStore,
        });

        // Must not throw — durability is best-effort
        await expect(
            svc.execute({
                workflowId: 'wf-1',
                userId: 'user-1',
                trigger: TriggerType.MANUAL,
                tenantId: 'tenant-1',
            }),
        ).resolves.toBeDefined();
    });
});
