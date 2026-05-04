import { randomUUID } from 'crypto';

import type { PrismaClient } from '@prisma/client';

/**
 * WaitpointService — minted-then-completed pause primitive
 * (trigger.dev parity).
 *
 * The shape:
 *   1. A step (or any tenant-scoped caller) calls `create()` with
 *      an optional timeout + tags. Returns `{ id, url }`.
 *   2. The run blocks until either:
 *        - someone POSTs the public URL with a value → COMPLETED
 *        - the watchdog finds the row past `expiresAt`     → TIMED_OUT
 *        - an operator cancels the run / waitpoint         → CANCELLED
 *   3. The blocked run picks up the token's `completedValue` and
 *      continues with that as the step output.
 *
 * Design notes:
 *   - The id doubles as the public address. We use a UUIDv4 with
 *     128 bits of entropy — enough that "guess the URL" attacks
 *     are not a concern even when the URL leaks into a customer-
 *     side audit log.
 *   - We store `executionId` nullable so a token can be minted
 *     BEFORE the blocking step is created (the "preflight URL"
 *     pattern: hand the URL to a vendor, then run a step that
 *     blocks on it).
 *   - Tenant isolation enforced at every method. The route layer
 *     gets the tenant from auth and passes it through; the
 *     service refuses cross-tenant access.
 */

export type WaitpointStatus = 'PENDING' | 'COMPLETED' | 'TIMED_OUT' | 'CANCELLED';

export interface CreateWaitpointInput {
  tenantId: string;
  /** Execution that will block on this token. Null for preflight. */
  executionId?: string | null;
  /** Absolute timeout. When null, the token never times out by clock. */
  timeoutMs?: number | null;
  tags?: string[];
}

export interface CompleteWaitpointInput {
  tenantId: string;
  /** Free-form value handed back to the blocked run. */
  value: unknown;
  /** Who completed it — operator id, system, or external label. */
  completedBy?: string | null;
}

export class WaitpointError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'CROSS_TENANT' | 'ALREADY_COMPLETED'
  ) {
    super(message);
    this.name = 'WaitpointError';
  }
}

export class WaitpointService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateWaitpointInput) {
    const id = `wpt_${randomUUID().replace(/-/g, '')}`;
    const expiresAt =
      input.timeoutMs && input.timeoutMs > 0 ? new Date(Date.now() + input.timeoutMs) : null;
    const row = await this.prisma.waitpoint.create({
      data: {
        id,
        tenantId: input.tenantId,
        executionId: input.executionId ?? null,
        expiresAt,
        tags: input.tags ?? [],
      },
    });
    return row;
  }

  async retrieve(id: string, tenantId: string) {
    const row = await this.prisma.waitpoint.findUnique({ where: { id } });
    if (!row) throw new WaitpointError(`Waitpoint ${id} not found`, 'NOT_FOUND');
    if (row.tenantId !== tenantId) {
      throw new WaitpointError(`Cross-tenant access refused for ${id}`, 'CROSS_TENANT');
    }
    return row;
  }

  async complete(id: string, input: CompleteWaitpointInput) {
    const existing = await this.retrieve(id, input.tenantId);
    if (existing.status !== 'PENDING') {
      throw new WaitpointError(
        `Waitpoint ${id} is already ${existing.status.toLowerCase()}`,
        'ALREADY_COMPLETED'
      );
    }
    return this.prisma.waitpoint.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedValue: input.value as object,
        completedBy: input.completedBy ?? null,
        completedAt: new Date(),
      },
    });
  }

  async cancel(id: string, tenantId: string) {
    const existing = await this.retrieve(id, tenantId);
    if (existing.status !== 'PENDING') return existing;
    return this.prisma.waitpoint.update({
      where: { id },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  }

  /**
   * Watchdog sweep: time out PENDING tokens whose expiresAt is in
   * the past. Returns the rows it flipped so the caller can resume
   * any executions that were blocked on them.
   *
   * Two-phase on purpose:
   *   1. SELECT candidates so we know which executions need a resume
   *      kick. (updateMany doesn't return updated rows in Prisma.)
   *   2. UPDATE filtered by `status = 'PENDING'` so a concurrent
   *      `complete()` wins the race: the row is already COMPLETED,
   *      our updateMany leaves it alone, and the linked execution
   *      doesn't get a duplicate resume signal (the execution
   *      service short-circuits non-PAUSED executions anyway, but
   *      keeping the SQL honest avoids the noise).
   *
   * Designed to run on a per-minute interval — the partial index
   * over (expiresAt, status='PENDING') keeps the scan cheap even
   * with millions of historical tokens.
   */
  async expireOverdue(
    now = new Date()
  ): Promise<Array<{ id: string; tenantId: string; executionId: string | null }>> {
    const candidates = await this.prisma.waitpoint.findMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      select: { id: true, tenantId: true, executionId: true },
    });
    if (candidates.length === 0) return [];
    await this.prisma.waitpoint.updateMany({
      where: { id: { in: candidates.map(c => c.id) }, status: 'PENDING' },
      data: { status: 'TIMED_OUT', completedAt: now },
    });
    return candidates;
  }

  async list(tenantId: string, opts: { status?: WaitpointStatus; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    return this.prisma.waitpoint.findMany({
      where: {
        tenantId,
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
