import { ResumeWorker } from '../../../runbook/engine/resume-worker';
import type { ExecutionEventStore } from '../../../runbook/engine/execution-event.store';
import type { RunState } from '../../../runbook/engine/execution-event.types';
import type { Logger } from '../../../services/logger.service';

const buildLogger = (): Logger => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
} as unknown as Logger);

const baseState = (overrides: Partial<RunState> = {}): RunState => ({
    executionId: 'exec-1',
    status: 'PENDING',
    workflowId: 'wf-1',
    workflowName: 'Deploy',
    trigger: 'manual',
    stepCount: 0,
    completedSteps: [],
    failedSteps: [],
    skippedSteps: [],
    pausedAt: null,
    errorMessage: null,
    durationMs: null,
    lastSeq: 1n,
    ...overrides,
});

describe('ResumeWorker.decide (pure)', () => {
    it('PENDING → ABANDON with "never started" reason', () => {
        const decision = ResumeWorker.decide(baseState({ status: 'PENDING' }), 't-1');
        expect(decision.action).toBe('ABANDON');
        expect(decision.reason).toMatch(/never started/i);
        expect(decision.tenantId).toBe('t-1');
    });

    it('RUNNING → ABANDON pending phase 4 step replay', () => {
        const decision = ResumeWorker.decide(baseState({ status: 'RUNNING' }), 't-1');
        expect(decision.action).toBe('ABANDON');
        expect(decision.reason).toMatch(/phase 4/);
    });

    it('PAUSED → SKIP (waiting on human resume)', () => {
        const decision = ResumeWorker.decide(
            baseState({ status: 'PAUSED', pausedAt: 'n-approval' }),
            't-1',
        );
        expect(decision.action).toBe('SKIP');
        expect(decision.reason).toMatch(/manual resume/i);
    });

    it('COMPLETED / FAILED / CANCELLED → SKIP defensively', () => {
        for (const status of ['COMPLETED', 'FAILED', 'CANCELLED'] as const) {
            const decision = ResumeWorker.decide(baseState({ status }), 't-1');
            expect(decision.action).toBe('SKIP');
            expect(decision.status).toBe(status);
        }
    });

    it('preserves executionId and lastSeq from the state', () => {
        const decision = ResumeWorker.decide(
            baseState({ executionId: 'exec-99', lastSeq: 42n }),
            't-1',
        );
        expect(decision.executionId).toBe('exec-99');
        expect(decision.lastSeq).toBe(42n);
    });
});

describe('ResumeWorker.runOnce', () => {
    /**
     * Build a fake event store that responds to the three methods the
     * worker calls. The state per execution id is supplied via a Map
     * so different test cases can configure different in-flight runs.
     */
    function buildStore(seed: {
        tenants: string[];
        inFlightByTenant: Record<string, string[]>;
        statesByExecution: Record<string, RunState | null>;
    }) {
        const appended: Array<{ executionId: string; tenantId: string; type: string }> = [];
        const store = {
            listTenantsWithEvents: jest.fn().mockResolvedValue(seed.tenants),
            listInFlightExecutions: jest.fn(async (tenantId: string) => {
                return seed.inFlightByTenant[tenantId] ?? [];
            }),
            reduceState: jest.fn(async (executionId: string) => {
                return seed.statesByExecution[executionId] ?? null;
            }),
            append: jest.fn(async (
                executionId: string,
                tenantId: string,
                event: { type: string },
            ) => {
                appended.push({ executionId, tenantId, type: event.type });
                return {} as never;
            }),
        } as unknown as ExecutionEventStore;
        return { store, appended };
    }

    it('returns an empty report when no tenants have events', async () => {
        const { store } = buildStore({
            tenants: [],
            inFlightByTenant: {},
            statesByExecution: {},
        });
        const worker = new ResumeWorker(store, buildLogger());

        const report = await worker.runOnce();
        expect(report.scannedTenants).toBe(0);
        expect(report.scannedRuns).toBe(0);
        expect(report.decisions).toEqual([]);
        expect(report.counts).toEqual({ ABANDON: 0, SKIP: 0, RESUME: 0 });
    });

    it('classifies a mix of in-flight runs across multiple tenants', async () => {
        const { store } = buildStore({
            tenants: ['t-1', 't-2'],
            inFlightByTenant: {
                't-1': ['exec-A', 'exec-B'],
                't-2': ['exec-C', 'exec-D'],
            },
            statesByExecution: {
                'exec-A': baseState({ executionId: 'exec-A', status: 'PENDING' }),
                'exec-B': baseState({ executionId: 'exec-B', status: 'RUNNING' }),
                'exec-C': baseState({ executionId: 'exec-C', status: 'PAUSED' }),
                'exec-D': baseState({ executionId: 'exec-D', status: 'RUNNING' }),
            },
        });
        const worker = new ResumeWorker(store, buildLogger());

        const report = await worker.runOnce();
        expect(report.scannedTenants).toBe(2);
        expect(report.scannedRuns).toBe(4);
        // 3 ABANDON (A, B, D) + 1 SKIP (C)
        expect(report.counts.ABANDON).toBe(3);
        expect(report.counts.SKIP).toBe(1);
        expect(report.counts.RESUME).toBe(0);
    });

    it('dryRun=true does NOT call store.append', async () => {
        const { store, appended } = buildStore({
            tenants: ['t-1'],
            inFlightByTenant: { 't-1': ['exec-A'] },
            statesByExecution: {
                'exec-A': baseState({ executionId: 'exec-A', status: 'RUNNING' }),
            },
        });
        const worker = new ResumeWorker(store, buildLogger());

        const report = await worker.runOnce({ dryRun: true });
        expect(report.counts.ABANDON).toBe(1);
        expect(appended).toEqual([]);
        expect(store.append).not.toHaveBeenCalled();
    });

    it('dryRun=false appends run.failed for each ABANDON decision', async () => {
        const { store, appended } = buildStore({
            tenants: ['t-1'],
            inFlightByTenant: { 't-1': ['exec-A', 'exec-B'] },
            statesByExecution: {
                'exec-A': baseState({ executionId: 'exec-A', status: 'PENDING' }),
                'exec-B': baseState({ executionId: 'exec-B', status: 'PAUSED' }),
            },
        });
        const worker = new ResumeWorker(store, buildLogger());

        await worker.runOnce({ dryRun: false });

        // exec-A → ABANDON → append run.failed
        // exec-B → SKIP → no append
        expect(appended).toHaveLength(1);
        expect(appended[0]).toEqual({
            executionId: 'exec-A',
            tenantId: 't-1',
            type: 'run.failed',
        });
    });

    it('skips runs whose state cannot be reduced (race with terminal write)', async () => {
        const { store, appended } = buildStore({
            tenants: ['t-1'],
            inFlightByTenant: { 't-1': ['exec-ghost'] },
            statesByExecution: { 'exec-ghost': null },
        });
        const worker = new ResumeWorker(store, buildLogger());

        const report = await worker.runOnce({ dryRun: false });
        expect(report.scannedRuns).toBe(1);
        expect(report.decisions).toHaveLength(0);
        expect(appended).toEqual([]);
    });

    it('does not crash when store.append throws on abandon', async () => {
        const { store } = buildStore({
            tenants: ['t-1'],
            inFlightByTenant: { 't-1': ['exec-A'] },
            statesByExecution: {
                'exec-A': baseState({ executionId: 'exec-A', status: 'RUNNING' }),
            },
        });
        // Override append to throw
        (store.append as jest.Mock).mockRejectedValue(new Error('postgres down'));

        const worker = new ResumeWorker(store, buildLogger());
        const report = await worker.runOnce({ dryRun: false });
        // Decision was made, the append failed, the worker logged and moved on
        expect(report.counts.ABANDON).toBe(1);
    });

    it('idempotency contract: a second runOnce after acting sees zero in-flight', async () => {
        // Simulate the post-act state by returning empty in-flight on the
        // second call. In real life listInFlightExecutions filters out
        // runs that now have a terminal event, which is what abandon adds.
        const inFlightCalls = ['t-1'];
        const store = {
            listTenantsWithEvents: jest.fn().mockResolvedValue(['t-1']),
            listInFlightExecutions: jest.fn(async () => {
                if (inFlightCalls.length > 0) {
                    inFlightCalls.shift();
                    return ['exec-A'];
                }
                return [];
            }),
            reduceState: jest.fn(async () =>
                baseState({ executionId: 'exec-A', status: 'RUNNING' }),
            ),
            append: jest.fn().mockResolvedValue({} as never),
        } as unknown as ExecutionEventStore;

        const worker = new ResumeWorker(store, buildLogger());
        const first = await worker.runOnce({ dryRun: false });
        const second = await worker.runOnce({ dryRun: false });

        expect(first.counts.ABANDON).toBe(1);
        expect(second.counts.ABANDON).toBe(0);
        expect(second.scannedRuns).toBe(0);
    });
});
