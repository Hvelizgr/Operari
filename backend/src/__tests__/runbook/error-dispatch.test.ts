import type { PrismaClient } from '@prisma/client';
import { ExecutionService } from '../../editor/execution/execution.service';

/**
 * Focused tests for the error-workflow-trigger dispatch helper inside
 * ExecutionService. The helper is private so we reach it via bracket
 * access — this keeps the helper out of the module's public surface
 * while still letting us pin the failure modes (no handler, ERROR
 * chain refusal, cycle, missing handler, happy path).
 *
 * Full end-to-end "runbook FAILs and the handler actually runs"
 * coverage lives in the existing execution.service.test.ts (which
 * exercises the runWorkflow → catch → dispatchErrorHandler path).
 * Here we isolate the decision tree so regressions surface cleanly.
 */

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
jest.mock('../../editor/execution/socket.service', () => ({
    socketService: {
        emitLog: jest.fn(),
        emitExecutionStatus: jest.fn(),
        emitNodeStatus: jest.fn(),
        initialize: jest.fn(),
    },
}));

const STUB_LOGGER = {
    info: jest.fn(),
    warn: jest.fn(),
};

interface FakeState {
    runbooks: Array<{ id: string; tenantId: string; name: string; onErrorRunbookId?: string | null }>;
    executions: Array<{ id: string; workflowId: string; parentExecutionId: string | null; trigger: string }>;
}

function buildService(state: FakeState) {
    const prisma = {
        runbook: {
            findFirst: jest.fn(
                async (args: { where: { id: string; tenantId: string } }) =>
                    state.runbooks.find(
                        (rb) => rb.id === args.where.id && rb.tenantId === args.where.tenantId,
                    ) ?? null,
            ),
        },
        execution: {
            findUnique: jest.fn(async (args: { where: { id: string } }) =>
                state.executions.find((e) => e.id === args.where.id) ?? null,
            ),
        },
    } as unknown as PrismaClient;

    const service = new ExecutionService(prisma);
    // Swap the `execute` method with a spy so we can assert what the
    // helper would have dispatched without running the whole engine.
    const executeSpy = jest.fn(async () => ({ id: 'spawned-child-id' }));
    (service as unknown as { execute: typeof executeSpy }).execute = executeSpy;

    return { service, executeSpy, prisma };
}

async function callDispatch(
    service: ExecutionService,
    params: {
        failedExecutionId: string;
        workflow: {
            id: string;
            name: string;
            tenantId: string;
            onErrorRunbookId?: string | null;
        };
        errorMessage?: string;
        tenantId?: string;
        userId?: string;
    },
) {
    const method = (service as unknown as {
        dispatchErrorHandler: (args: {
            failedExecutionId: string;
            workflow: unknown;
            errorMessage: string;
            tenantId: string | undefined;
            userId: string;
            contextLogger: { info: jest.Mock; warn: jest.Mock };
        }) => Promise<void>;
    }).dispatchErrorHandler.bind(service);

    await method({
        failedExecutionId: params.failedExecutionId,
        workflow: params.workflow,
        errorMessage: params.errorMessage ?? 'step kaboom',
        tenantId: params.tenantId ?? params.workflow.tenantId,
        userId: params.userId ?? 'user-1',
        contextLogger: STUB_LOGGER as unknown as { info: jest.Mock; warn: jest.Mock },
    });
}

describe('ExecutionService.dispatchErrorHandler', () => {
    beforeEach(() => {
        STUB_LOGGER.info.mockReset();
        STUB_LOGGER.warn.mockReset();
    });

    it('does nothing when onErrorRunbookId is not set', async () => {
        const { service, executeSpy } = buildService({ runbooks: [], executions: [] });
        await callDispatch(service, {
            failedExecutionId: 'run-1',
            workflow: { id: 'rb-parent', tenantId: 't-1', name: 'parent' /* no onError */ },
        });
        expect(executeSpy).not.toHaveBeenCalled();
    });

    it('skips when the failed run was itself ERROR-triggered (no recursive handler chain)', async () => {
        const { service, executeSpy } = buildService({
            runbooks: [
                { id: 'rb-handler', tenantId: 't-1', name: 'handler' },
                { id: 'rb-parent', tenantId: 't-1', name: 'parent', onErrorRunbookId: 'rb-handler' },
            ],
            executions: [
                { id: 'run-err', workflowId: 'rb-parent', parentExecutionId: 'run-root', trigger: 'ERROR' },
            ],
        });

        await callDispatch(service, {
            failedExecutionId: 'run-err',
            workflow: { id: 'rb-parent', tenantId: 't-1', name: 'parent', onErrorRunbookId: 'rb-handler' },
        });

        expect(executeSpy).not.toHaveBeenCalled();
        expect(STUB_LOGGER.info).toHaveBeenCalledWith(
            expect.stringMatching(/ERROR-triggered/),
        );
    });

    it('skips when the handler already appears in the ancestor chain (cycle)', async () => {
        const { service, executeSpy } = buildService({
            runbooks: [
                { id: 'rb-handler', tenantId: 't-1', name: 'handler' },
                { id: 'rb-parent', tenantId: 't-1', name: 'parent', onErrorRunbookId: 'rb-handler' },
            ],
            // Ancestor chain: run-handler (handler) → run-mid (parent, MANUAL)
            executions: [
                { id: 'run-top', workflowId: 'rb-handler', parentExecutionId: null, trigger: 'MANUAL' },
                { id: 'run-mid', workflowId: 'rb-parent', parentExecutionId: 'run-top', trigger: 'MANUAL' },
            ],
        });

        await callDispatch(service, {
            failedExecutionId: 'run-mid',
            workflow: { id: 'rb-parent', tenantId: 't-1', name: 'parent', onErrorRunbookId: 'rb-handler' },
        });

        expect(executeSpy).not.toHaveBeenCalled();
        expect(STUB_LOGGER.warn).toHaveBeenCalledWith(
            expect.stringMatching(/already in the run chain/),
        );
    });

    it('skips when the handler runbook does not exist in the tenant', async () => {
        const { service, executeSpy } = buildService({
            runbooks: [
                // Handler lives in a DIFFERENT tenant — same id, wrong tenantId
                { id: 'rb-handler', tenantId: 't-other', name: 'handler' },
            ],
            executions: [
                { id: 'run-mid', workflowId: 'rb-parent', parentExecutionId: null, trigger: 'MANUAL' },
            ],
        });

        await callDispatch(service, {
            failedExecutionId: 'run-mid',
            workflow: { id: 'rb-parent', tenantId: 't-1', name: 'parent', onErrorRunbookId: 'rb-handler' },
        });

        expect(executeSpy).not.toHaveBeenCalled();
        expect(STUB_LOGGER.warn).toHaveBeenCalledWith(
            expect.stringMatching(/not found in tenant/),
            expect.anything(),
        );
    });

    it('dispatches the handler with trigger=ERROR and the error payload on the happy path', async () => {
        const { service, executeSpy } = buildService({
            runbooks: [
                { id: 'rb-handler', tenantId: 't-1', name: 'rollback' },
                { id: 'rb-parent', tenantId: 't-1', name: 'deploy', onErrorRunbookId: 'rb-handler' },
            ],
            executions: [
                { id: 'run-failed', workflowId: 'rb-parent', parentExecutionId: null, trigger: 'MANUAL' },
            ],
        });

        await callDispatch(service, {
            failedExecutionId: 'run-failed',
            workflow: { id: 'rb-parent', tenantId: 't-1', name: 'deploy', onErrorRunbookId: 'rb-handler' },
            errorMessage: 'kubectl apply failed',
            tenantId: 't-1',
            userId: 'sre-1',
        });

        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(executeSpy).toHaveBeenCalledWith({
            workflowId: 'rb-handler',
            userId: 'sre-1',
            tenantId: 't-1',
            trigger: 'ERROR',
            parentExecutionId: 'run-failed',
            input: {
                error: {
                    runId: 'run-failed',
                    runbookId: 'rb-parent',
                    runbookName: 'deploy',
                    message: 'kubectl apply failed',
                },
            },
        });
    });

    it('swallows a throw from execute() instead of bubbling into the parent FAILED transition', async () => {
        const { service, executeSpy } = buildService({
            runbooks: [
                { id: 'rb-handler', tenantId: 't-1', name: 'rollback' },
                { id: 'rb-parent', tenantId: 't-1', name: 'deploy', onErrorRunbookId: 'rb-handler' },
            ],
            executions: [
                { id: 'run-failed', workflowId: 'rb-parent', parentExecutionId: null, trigger: 'MANUAL' },
            ],
        });
        executeSpy.mockRejectedValueOnce(new Error('downstream prisma crash'));

        await expect(
            callDispatch(service, {
                failedExecutionId: 'run-failed',
                workflow: { id: 'rb-parent', tenantId: 't-1', name: 'deploy', onErrorRunbookId: 'rb-handler' },
            }),
        ).resolves.not.toThrow();

        expect(STUB_LOGGER.warn).toHaveBeenCalledWith(
            expect.stringMatching(/dispatch threw/),
            expect.anything(),
        );
    });
});
