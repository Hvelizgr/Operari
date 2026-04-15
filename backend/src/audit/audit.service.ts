import { createHash } from 'crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import { canonicalJson } from './canonical-json';

/**
 * Stable identifiers for the kinds of events NanoRun audits.
 *
 * Add new types here, do not invent them at call sites — having a closed
 * union makes it possible to grep for every place that emits a given type
 * and to enforce shape with discriminated unions later.
 */
export type AuditEventType =
    | 'run.started'
    | 'run.completed'
    | 'run.failed'
    | 'run.cancelled'
    | 'run.paused'
    | 'run.resumed'
    | 'step.completed'
    | 'step.failed'
    | 'step.skipped'
    | 'approval.requested'
    | 'approval.granted'
    | 'approval.rejected'
    | 'runbook.created'
    | 'runbook.updated'
    | 'runbook.deleted'
    | 'secret.accessed'
    | 'role.granted'
    | 'role.revoked'
    | 'connectedaccount.linked'
    | 'connectedaccount.unlinked'
    | 'apikey.created'
    | 'apikey.used'
    | 'apikey.revoked'
    | 'auth.login'
    | 'auth.logout';

export type ActorType = 'user' | 'apikey' | 'system' | 'webhook';

export interface AuditWriteInput {
    tenantId: string;
    type: AuditEventType;
    actorId?: string | null;
    actorType?: ActorType | null;
    resource?: string | null;
    payload: Record<string, unknown>;
}

export interface AuditChainStatus {
    tenantId: string;
    eventCount: number;
    /** First event whose hash does not match its recomputed value, or null if intact */
    firstBrokenSeq: bigint | null;
    /** Detected gap in the seq column, or null if contiguous */
    firstGapAfterSeq: bigint | null;
}

/**
 * AuditService — append-only, hash-chained writes plus chain verification.
 *
 * The Postgres trigger installed by the `add_audit_event` migration blocks
 * UPDATE/DELETE/TRUNCATE on the `AuditEvent` table. This service is
 * responsible for the chain itself: each new row links to the previous
 * tenant row's hash, and `verifyChain()` walks the table to detect any
 * tampering.
 *
 * CONCURRENCY: writes are serialized per-tenant via an advisory lock so
 * two parallel `record()` calls cannot fork the chain. We use
 * pg_advisory_xact_lock keyed on a hash of the tenant ID, scoped to the
 * surrounding transaction.
 */
export class AuditService {
    constructor(private readonly prisma: PrismaClient) { }

    /**
     * Append an event to a tenant's audit chain.
     *
     * Runs inside a transaction so the lookup of the previous hash and the
     * insert of the new row are atomic. Concurrent calls for the same
     * tenant block on the advisory lock until the first commits.
     */
    async record(input: AuditWriteInput): Promise<{ id: string; hash: string; seq: bigint }> {
        const { tenantId, type, actorId, actorType, resource, payload } = input;

        return this.prisma.$transaction(async (tx) => {
            // Per-tenant serialization. The lock is released at the end of
            // the transaction. Two int4 keys → "namespace=audit, tenant=hash".
            const lockKey = AuditService.tenantLockKey(tenantId);
            await tx.$executeRawUnsafe(
                `SELECT pg_advisory_xact_lock($1::int, $2::int)`,
                lockKey.namespace,
                lockKey.tenant,
            );

            const previous = await tx.auditEvent.findFirst({
                where: { tenantId },
                orderBy: { seq: 'desc' },
                select: { hash: true },
            });
            const prevHash = previous?.hash ?? '';

            const hash = AuditService.computeHash(prevHash, payload);

            const created = await tx.auditEvent.create({
                data: {
                    tenantId,
                    type,
                    actorId: actorId ?? null,
                    actorType: actorType ?? null,
                    resource: resource ?? null,
                    payload: payload as Prisma.InputJsonValue,
                    hash,
                    prevHash,
                },
                select: { id: true, hash: true, seq: true },
            });

            return created;
        });
    }

    /**
     * Walk a tenant's audit chain in sequence order and re-verify each
     * row's hash. Returns the first broken position (or null) and any gap
     * in the seq column.
     *
     * O(n) — fine for tens of thousands of rows but should be paginated
     * via `fromSeq` for very large tenants. Used by both periodic
     * background checks and on-demand compliance dumps.
     */
    async verifyChain(tenantId: string, options: { fromSeq?: bigint; pageSize?: number } = {}): Promise<AuditChainStatus> {
        const pageSize = options.pageSize ?? 1000;
        let cursorSeq: bigint | undefined = options.fromSeq;
        let expectedPrevHash = '';
        let expectedNextSeq: bigint | null = null;
        let totalCount = 0;
        let firstBrokenSeq: bigint | null = null;
        let firstGapAfterSeq: bigint | null = null;

        // Seed expectedPrevHash if we are starting mid-chain
        if (cursorSeq !== undefined && cursorSeq > 0n) {
            const prior = await this.prisma.auditEvent.findFirst({
                where: { tenantId, seq: { lt: cursorSeq } },
                orderBy: { seq: 'desc' },
                select: { hash: true, seq: true },
            });
            expectedPrevHash = prior?.hash ?? '';
            expectedNextSeq = prior ? prior.seq + 1n : null;
        }

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const page = await this.prisma.auditEvent.findMany({
                where: {
                    tenantId,
                    ...(cursorSeq !== undefined ? { seq: { gte: cursorSeq } } : {}),
                },
                orderBy: { seq: 'asc' },
                take: pageSize,
                select: {
                    seq: true,
                    payload: true,
                    hash: true,
                    prevHash: true,
                },
            });
            if (page.length === 0) break;

            for (const row of page) {
                totalCount++;
                if (expectedNextSeq !== null && row.seq !== expectedNextSeq) {
                    firstGapAfterSeq ??= expectedNextSeq - 1n;
                }
                if (row.prevHash !== expectedPrevHash) {
                    firstBrokenSeq ??= row.seq;
                }
                const recomputed = AuditService.computeHash(
                    row.prevHash,
                    row.payload as Record<string, unknown>,
                );
                if (recomputed !== row.hash) {
                    firstBrokenSeq ??= row.seq;
                }
                expectedPrevHash = row.hash;
                expectedNextSeq = row.seq + 1n;
            }

            cursorSeq = page[page.length - 1].seq + 1n;
            if (page.length < pageSize) break;
        }

        return {
            tenantId,
            eventCount: totalCount,
            firstBrokenSeq,
            firstGapAfterSeq,
        };
    }

    /**
     * Compute the hash for a single event. Exposed for tests.
     *
     * sha256(prevHash || ':' || canonicalJson(payload))
     *
     * The colon separator prevents hash-extension ambiguity between two
     * payloads that happen to begin with the previous hash.
     */
    static computeHash(prevHash: string, payload: Record<string, unknown>): string {
        return createHash('sha256')
            .update(prevHash)
            .update(':')
            .update(canonicalJson(payload))
            .digest('hex');
    }

    /**
     * Derive a (namespace, tenant) int32 pair for pg_advisory_xact_lock.
     * Namespace is a constant `0x4E52` ("NR") so we never collide with
     * locks from other subsystems. Tenant is the lowest 31 bits of a
     * sha256 of the tenant ID — int32 must be non-negative.
     */
    static tenantLockKey(tenantId: string): { namespace: number; tenant: number } {
        const digest = createHash('sha256').update(tenantId).digest();
        const tenant = digest.readUInt32BE(0) & 0x7fffffff;
        return { namespace: 0x4e52, tenant };
    }
}
