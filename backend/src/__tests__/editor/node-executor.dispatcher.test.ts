/**
 * Tests for the registry-based dispatcher introduced by ADR 0002 step 5.
 *
 * The integration tests in src/__tests__/services/node-executor.service.test.ts
 * exercise specific node behaviors. THIS file pins the dispatcher contract:
 * unknown types throw, aliases route to the same executor, the runbook
 * registry takes precedence, and the editor registry is reachable for every
 * known node type.
 */

import { NodeExecutor } from '../../editor/node-executor.service';
import { NodeExecutionError, ErrorCode } from '../../errors/custom-error';
import { SecretTemplateResolver } from '../../runbook/secrets/secret-template-resolver';

jest.mock('nodemailer');
jest.mock('../../services/logger.service', () => ({
    Logger: {
        getInstance: jest.fn().mockReturnValue({
            error: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            retryAttempt: jest.fn(),
            logError: jest.fn(),
            executionStart: jest.fn(),
            executionEnd: jest.fn(),
            nodeStart: jest.fn(),
            nodeEnd: jest.fn(),
        }),
    },
}));
describe('NodeExecutor dispatcher (ADR 0002 step 5)', () => {
    let executor: NodeExecutor;

    beforeEach(() => {
        jest.clearAllMocks();
        executor = new NodeExecutor();
    });

    it('throws NODE_NOT_FOUND for an unknown node type', async () => {
        try {
            await executor.execute(
                {
                    id: 'n-1',
                    type: 'NotARealType',
                    title: 'Mystery',
                    position: { x: 0, y: 0 },
                    config: {},
                },
                {},
            );
            fail('expected throw');
        } catch (err) {
            expect(err).toBeInstanceOf(NodeExecutionError);
            expect((err as NodeExecutionError).code).toBe(ErrorCode.NODE_NOT_FOUND);
        }
    });

    it('routes Trigger and its Webhook/Schedule/nanorun.* aliases to the same executor', async () => {
        const make = (type: string) =>
            executor.execute(
                {
                    id: 'n',
                    type,
                    title: type,
                    position: { x: 0, y: 0 },
                    config: {},
                },
                { source: 'test' },
            );

        // Pin BOTH the legacy aliases (Webhook, Schedule) AND the
        // post-pivot nanorun.* aliases that the curated palette emits.
        // The connection-dispatch fix added these so the new node
        // type strings actually find their executor.
        const results = await Promise.all([
            make('Trigger'),
            make('Webhook'),
            make('Schedule'),
            make('nanorun.webhook'),
            make('nanorun.cron'),
        ]);

        for (const result of results) {
            const r = result as Record<string, unknown>;
            expect(r.triggered).toBe(true);
            expect(typeof r.timestamp).toBe('string');
            expect(r.source).toBe('test');
        }
    });

    it('routes nanorun.httpRequest, nanorun.if, nanorun.loop, nanorun.postgres aliases', async () => {
        // Each of these post-pivot type strings was an orphan before
        // the connection-dispatch fix. Now they have to dispatch to
        // their legacy-named executors via aliases. We do not assert
        // the result shape here because each executor is exercised by
        // its own dedicated test file — this case only pins that
        // dispatch *finds* the executor (no NODE_NOT_FOUND throw).
        const types = [
            'nanorun.httpRequest',
            'nanorun.if',
            'nanorun.loop',
            'nanorun.postgres',
        ];
        for (const type of types) {
            // Each may resolve, throw a config error, or do an HTTP
            // call we cannot mock here — what we forbid is the dispatcher
            // throwing NODE_NOT_FOUND.
            try {
                await executor.execute(
                    {
                        id: 'n',
                        type,
                        title: type,
                        position: { x: 0, y: 0 },
                        config:
                            type === 'nanorun.postgres'
                                ? { operation: 'health' }
                                : type === 'nanorun.httpRequest'
                                    ? { url: 'https://invalid.local.test' }
                                    : type === 'nanorun.if'
                                        ? { field: 'x', operator: 'equals', value: 'y' }
                                        : { items: [] },
                    },
                    {},
                );
            } catch (err) {
                if (err instanceof NodeExecutionError) {
                    expect(err.code).not.toBe(ErrorCode.NODE_NOT_FOUND);
                }
                // anything else is fine for this contract test
            }
        }
    });

    it('routes the Suspend node and signals isSuspended=true', async () => {
        const result = await executor.execute(
            {
                id: 'n',
                type: 'Suspend',
                title: 'Pause here',
                position: { x: 0, y: 0 },
                config: {},
            },
            { runId: 'r-1' },
        );
        expect((result as Record<string, unknown>).isSuspended).toBe(true);
    });

    it('routes the Delay alias Wait through the same executor as Delay', async () => {
        const result = await executor.execute(
            {
                id: 'n',
                type: 'Wait',
                title: 'Wait a bit',
                position: { x: 0, y: 0 },
                config: { duration: 30 },
            },
            {},
        );
        const r = result as Record<string, unknown>;
        expect(r.delayed).toBe(true);
        expect(r.duration).toBe(30);
    });

    it('routes the Database type through the database stub for migrate ops', async () => {
        const result = await executor.execute(
            {
                id: 'n',
                type: 'Database',
                title: 'Migrate',
                position: { x: 0, y: 0 },
                config: { operation: 'migrate', table: 'users' },
            },
            {},
        );
        const r = result as Record<string, unknown>;
        expect(r.operation).toBe('migrate');
        expect(r.table).toBe('users');
        expect(typeof r.message).toBe('string');
    });

    it('throws CONFIGURATION_ERROR for StoreSet without tenantId', async () => {
        try {
            await executor.execute(
                {
                    id: 'n',
                    type: 'StoreSet',
                    title: 'Save',
                    position: { x: 0, y: 0 },
                    config: { key: 'k', value: 'v' },
                },
                {},
                undefined, // tenantId omitted on purpose
            );
            fail('expected throw');
        } catch (err) {
            expect((err as NodeExecutionError).code).toBe(ErrorCode.CONFIGURATION_ERROR);
        }
    });

    it('passes input through unchanged for custom.note', async () => {
        const result = await executor.execute(
            {
                id: 'n',
                type: 'custom.note',
                title: 'Note',
                position: { x: 0, y: 0 },
                config: {},
            },
            { x: 1, y: 'two' },
        );
        expect(result).toEqual({ x: 1, y: 'two' });
    });

    describe('secret pre-resolution for runbook nodes', () => {
        // The dispatcher pre-resolves `{{secrets.<id>}}` references
        // before invoking the runbook executor (see
        // node-executor.service.ts → tryRunbookExecutor). These tests
        // pin the wiring without needing real cipher / postgres /
        // network — the SecretTemplateResolver is stubbed via the
        // constructor option.

        const originalKey = process.env.ENCRYPTION_KEY;
        afterEach(() => {
            if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
            else process.env.ENCRYPTION_KEY = originalKey;
        });

        it('throws a clear error when a runbook step references a secret but no resolver can be built', async () => {
            // No ENCRYPTION_KEY → lazy resolver returns undefined →
            // dispatcher must convert that into a NodeExecutionError
            // mentioning the env var instead of letting an opaque
            // error reach the executor.
            delete process.env.ENCRYPTION_KEY;
            const noResolverExecutor = new NodeExecutor();

            await expect(
                noResolverExecutor.execute(
                    {
                        id: 'notify-1',
                        type: 'notify',
                        title: 'Notify',
                        position: { x: 0, y: 0 },
                        config: {
                            channel: 'slack',
                            webhookUrl: 'https://hooks.slack.com/{{secrets.gh-bot}}',
                            message: 'hi',
                        },
                    },
                    {},
                    'tenant-1',
                    'run-1',
                ),
            ).rejects.toMatchObject({
                code: ErrorCode.NODE_EXECUTION_FAILED,
                message: expect.stringContaining('ENCRYPTION_KEY'),
            });
        });

        it('passes runId, stepId, and tenantId through to the resolver', async () => {
            const calls: Array<{
                tenantId: string;
                runId: string;
                stepId: string;
            }> = [];
            const stub = {
                async resolve(input: {
                    tenantId: string;
                    runId: string;
                    stepId: string;
                }): Promise<Record<string, string>> {
                    calls.push({
                        tenantId: input.tenantId,
                        runId: input.runId,
                        stepId: input.stepId,
                    });
                    return { 'gh-bot': 'PLAINTEXT_TOKEN' };
                },
            } as unknown as SecretTemplateResolver;

            const stubbedExecutor = new NodeExecutor(undefined, {
                secretResolver: stub,
            });

            // The notify step will fail when it tries to fetch the
            // (now resolved) URL — that is fine. We only assert that
            // the resolver was called with the right context BEFORE
            // any traffic happened.
            await stubbedExecutor
                .execute(
                    {
                        id: 'notify-step',
                        type: 'notify',
                        title: 'Notify',
                        position: { x: 0, y: 0 },
                        config: {
                            channel: 'slack',
                            webhookUrl:
                                'https://hooks.slack.com/services/{{secrets.gh-bot}}',
                            message: 'deploy ok',
                        },
                    },
                    {},
                    'tenant-42',
                    'run-99',
                )
                .catch(() => {
                    /* notify failure expected without a real webhook */
                });

            expect(calls).toEqual([
                {
                    tenantId: 'tenant-42',
                    runId: 'run-99',
                    stepId: 'notify-step',
                },
            ]);
        });

        it('does not invoke the resolver when the config has no secret references', async () => {
            const stub = {
                resolve: jest.fn(),
            } as unknown as SecretTemplateResolver;
            const stubbedExecutor = new NodeExecutor(undefined, {
                secretResolver: stub,
            });

            // Use a runbook node type ('wait') that does not need
            // network or templates — pinpoints that the
            // extractRefs short-circuit prevents resolver calls.
            await stubbedExecutor.execute(
                {
                    id: 'wait-step',
                    type: 'wait',
                    title: 'Wait',
                    position: { x: 0, y: 0 },
                    config: { durationMs: 1 },
                },
                {},
                'tenant-1',
                'run-1',
            );

            expect((stub.resolve as jest.Mock)).not.toHaveBeenCalled();
        });
    });
});
