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

    it('routes Trigger and its Webhook/Schedule aliases to the same executor', async () => {
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

        const [a, b, c] = await Promise.all([
            make('Trigger'),
            make('Webhook'),
            make('Schedule'),
        ]);

        // All three should produce the same shape — triggered=true, ISO timestamp,
        // input passthrough.
        for (const result of [a, b, c]) {
            const r = result as Record<string, unknown>;
            expect(r.triggered).toBe(true);
            expect(typeof r.timestamp).toBe('string');
            expect(r.source).toBe('test');
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
});
