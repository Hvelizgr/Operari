import type { PrismaClient } from '@prisma/client';
import { TriggerNodeExecutor } from '../../../editor/nodes/trigger.executor';
import { LoopNodeExecutor } from '../../../editor/nodes/loop.executor';
import { SuspendNodeExecutor } from '../../../editor/nodes/suspend.executor';
import { StoreSetNodeExecutor } from '../../../editor/nodes/store-set.executor';
import { StoreGetNodeExecutor } from '../../../editor/nodes/store-get.executor';
import { SetMetadataNodeExecutor } from '../../../editor/nodes/set-metadata.executor';
import { NodeExecutionError, ErrorCode } from '../../../errors/custom-error';

const errCtx = (type = 'Test') => ({ nodeId: 'n', nodeName: type, nodeType: type });

// ---------------------------------------------------------------------------
// TriggerNodeExecutor
// ---------------------------------------------------------------------------
describe('TriggerNodeExecutor', () => {
    const exec = new TriggerNodeExecutor();

    it('exposes type=Trigger and Webhook/Schedule aliases', () => {
        expect(exec.type).toBe('Trigger');
        expect(exec.aliases).toEqual(['Webhook', 'Schedule', 'nanorun.webhook', 'nanorun.cron']);
    });

    it('stamps triggered=true and an ISO timestamp on the input', async () => {
        const result = await exec.execute({}, { source: 'cron' }, errCtx('Trigger'));
        expect(result.triggered).toBe(true);
        expect(typeof result.timestamp).toBe('string');
        expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
        expect((result as Record<string, unknown>).source).toBe('cron');
    });
});

// ---------------------------------------------------------------------------
// LoopNodeExecutor
// ---------------------------------------------------------------------------
describe('LoopNodeExecutor', () => {
    const exec = new LoopNodeExecutor();

    it('exposes type=Loop and Iterator alias', () => {
        expect(exec.type).toBe('Loop');
        expect(exec.aliases).toEqual(['Iterator', 'nanorun.loop']);
    });

    it('uses inline items when itemsPath is not set', async () => {
        const result = await exec.execute({ items: [1, 2, 3] }, {}, errCtx('Loop'));
        expect(result.items).toEqual([1, 2, 3]);
        expect(result.count).toBe(3);
    });

    it('reads items from a nested path on the input', async () => {
        const result = await exec.execute(
            { itemsPath: 'data.users' },
            { data: { users: ['a', 'b'] } },
            errCtx('Loop'),
        );
        expect(result.items).toEqual(['a', 'b']);
        expect(result.count).toBe(2);
    });

    it('returns an empty array when the resolved value is not iterable', async () => {
        const result = await exec.execute(
            { itemsPath: 'data.missing' },
            { data: {} },
            errCtx('Loop'),
        );
        expect(result.items).toEqual([]);
        expect(result.count).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// SuspendNodeExecutor
// ---------------------------------------------------------------------------
describe('SuspendNodeExecutor', () => {
    const exec = new SuspendNodeExecutor();

    it('exposes type=Suspend', () => {
        expect(exec.type).toBe('Suspend');
    });

    it('signals isSuspended=true while preserving the input', async () => {
        const result = await exec.execute({}, { runId: 'r-1', x: 7 }, errCtx('Suspend'));
        expect(result.isSuspended).toBe(true);
        expect((result as Record<string, unknown>).runId).toBe('r-1');
        expect((result as Record<string, unknown>).x).toBe(7);
    });
});

// ---------------------------------------------------------------------------
// StoreSetNodeExecutor
// ---------------------------------------------------------------------------
describe('StoreSetNodeExecutor', () => {
    const buildPrisma = () => {
        const buckets: Array<{ id: string; tenantId: string; name: string; data: Record<string, unknown> }> = [];
        let nextId = 1;
        return {
            buckets,
            prisma: {
                storageBucket: {
                    upsert: jest.fn(async (args: {
                        where: { tenantId_name: { tenantId: string; name: string } };
                        create: { name: string; tenantId: string; data: Record<string, unknown> };
                    }) => {
                        const found = buckets.find(
                            (b) =>
                                b.tenantId === args.where.tenantId_name.tenantId &&
                                b.name === args.where.tenantId_name.name,
                        );
                        if (found) return found;
                        const created = { id: `b-${nextId++}`, ...args.create };
                        buckets.push(created);
                        return created;
                    }),
                    update: jest.fn(async (args: {
                        where: { id: string };
                        data: { data: Record<string, unknown> };
                    }) => {
                        const b = buckets.find((x) => x.id === args.where.id);
                        if (b) b.data = args.data.data;
                        return b!;
                    }),
                },
            } as unknown as PrismaClient,
        };
    };

    it('throws CONFIGURATION_ERROR when tenantId is missing', async () => {
        const { prisma } = buildPrisma();
        const exec = new StoreSetNodeExecutor(prisma);
        try {
            await exec.execute({ key: 'k', value: 'v' }, {}, errCtx('StoreSet'));
            fail('expected throw');
        } catch (err) {
            expect((err as NodeExecutionError).code).toBe(ErrorCode.CONFIGURATION_ERROR);
        }
    });

    it('throws CONFIGURATION_ERROR when key is missing', async () => {
        const { prisma } = buildPrisma();
        const exec = new StoreSetNodeExecutor(prisma);
        await expect(
            exec.execute({ value: 'v' }, {}, errCtx('StoreSet'), 't-1'),
        ).rejects.toMatchObject({ code: ErrorCode.CONFIGURATION_ERROR });
    });

    it('upserts the bucket and merges the resolved key/value', async () => {
        const { buckets, prisma } = buildPrisma();
        const exec = new StoreSetNodeExecutor(prisma);

        const result = await exec.execute(
            { bucketName: 'env-{{stage}}', key: 'last-{{action}}', value: '{{value}}' },
            { stage: 'prod', action: 'deploy', value: 'v1.2.3' },
            errCtx('StoreSet'),
            't-1',
        );

        expect(result.success).toBe(true);
        expect(result.key).toBe('last-deploy');
        expect(result.value).toBe('v1.2.3');
        expect(buckets).toHaveLength(1);
        expect(buckets[0].name).toBe('env-prod');
        expect(buckets[0].data).toEqual({ 'last-deploy': 'v1.2.3' });
    });
});

// ---------------------------------------------------------------------------
// StoreGetNodeExecutor
// ---------------------------------------------------------------------------
describe('StoreGetNodeExecutor', () => {
    const buildPrisma = (
        rows: Array<{ tenantId: string; name: string; data: Record<string, unknown> }>,
    ) => ({
        storageBucket: {
            findUnique: jest.fn(async (args: {
                where: { tenantId_name: { tenantId: string; name: string } };
            }) => {
                return (
                    rows.find(
                        (r) =>
                            r.tenantId === args.where.tenantId_name.tenantId &&
                            r.name === args.where.tenantId_name.name,
                    ) ?? null
                );
            }),
        },
    } as unknown as PrismaClient);

    it('throws CONFIGURATION_ERROR when tenantId is missing', async () => {
        const exec = new StoreGetNodeExecutor(buildPrisma([]));
        await expect(
            exec.execute({ key: 'k' }, {}, errCtx('StoreGet')),
        ).rejects.toMatchObject({ code: ErrorCode.CONFIGURATION_ERROR });
    });

    it('returns the value merged into the input under the resolved key', async () => {
        const prisma = buildPrisma([
            { tenantId: 't-1', name: 'default', data: { foo: 'bar' } },
        ]);
        const exec = new StoreGetNodeExecutor(prisma);
        const result = await exec.execute(
            { key: '{{lookup}}' },
            { lookup: 'foo' },
            errCtx('StoreGet'),
            't-1',
        );
        expect((result as Record<string, unknown>).foo).toBe('bar');
    });

    it('returns null for missing buckets', async () => {
        const prisma = buildPrisma([]);
        const exec = new StoreGetNodeExecutor(prisma);
        const result = await exec.execute(
            { key: 'foo' },
            {},
            errCtx('StoreGet'),
            't-1',
        );
        expect((result as Record<string, unknown>).foo).toBeNull();
    });

    it('returns null for missing keys in an existing bucket', async () => {
        const prisma = buildPrisma([
            { tenantId: 't-1', name: 'default', data: { other: 1 } },
        ]);
        const exec = new StoreGetNodeExecutor(prisma);
        const result = await exec.execute(
            { key: 'missing' },
            {},
            errCtx('StoreGet'),
            't-1',
        );
        expect((result as Record<string, unknown>).missing).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// SetMetadataNodeExecutor
// ---------------------------------------------------------------------------
describe('SetMetadataNodeExecutor', () => {
    const buildPrisma = (initialMetadata: Record<string, unknown> = {}) => {
        const state = { metadata: initialMetadata };
        return {
            state,
            prisma: {
                execution: {
                    findUnique: jest.fn(async () => ({ metadata: state.metadata })),
                    update: jest.fn(async (args: { data: { metadata: Record<string, unknown> } }) => {
                        state.metadata = args.data.metadata;
                        return state;
                    }),
                },
            } as unknown as PrismaClient,
        };
    };

    it('throws CONFIGURATION_ERROR when executionId is missing', async () => {
        const { prisma } = buildPrisma();
        const exec = new SetMetadataNodeExecutor(prisma);
        await expect(
            exec.execute({ metadata: { x: 1 } }, {}, errCtx('SetMetadata')),
        ).rejects.toMatchObject({ code: ErrorCode.CONFIGURATION_ERROR });
    });

    it('throws NODE_EXECUTION_FAILED when metadata payload is missing', async () => {
        const { prisma } = buildPrisma();
        const exec = new SetMetadataNodeExecutor(prisma);
        await expect(
            exec.execute({} as never, {}, errCtx('SetMetadata'), undefined, 'exec-1'),
        ).rejects.toMatchObject({ code: ErrorCode.NODE_EXECUTION_FAILED });
    });

    it('shallow-merges new metadata into the existing execution row', async () => {
        const { state, prisma } = buildPrisma({ existing: 'keep' });
        const exec = new SetMetadataNodeExecutor(prisma);
        const result = await exec.execute(
            { metadata: { release: '{{version}}', actor: 'cron' } },
            { version: '1.4.0' },
            errCtx('SetMetadata'),
            undefined,
            'exec-1',
        );
        expect(result.success).toBe(true);
        expect(state.metadata).toEqual({
            existing: 'keep',
            release: '1.4.0',
            actor: 'cron',
        });
    });
});
