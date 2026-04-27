import { ApiKey, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { AuditService } from '../../audit/audit.service';

export interface ApiKeyContext {
  keyId: string;
  tenantId: string;
  scopes: string[];
}

export interface CreatedApiKey extends ApiKey {
  /** Plain key, only available at creation time. */
  plainKey: string;
}

export interface ApiKeyServiceOptions {
  /**
   * Audit service used to record key lifecycle events. Pass `null` to
   * disable, otherwise a default instance is built from prisma.
   */
  audit?: AuditService | null;
}

/**
 * Manages Operari API keys used by the SDK and CLI to authenticate.
 *
 * Keys have the format: nr_<env>_<24 random url-safe bytes>
 * The full key is shown only once at creation; we store a bcrypt hash.
 *
 * Audit events:
 *   - apikey.created  → on every successful create()
 *   - apikey.used     → on the FIRST successful validate() per key (first
 *                       use after creation). Subsequent uses are tracked
 *                       only via lastUsedAt to avoid blowing up the
 *                       audit chain on every API request.
 *   - apikey.revoked  → on every successful revoke()
 *
 * The audit payload NEVER includes the plain key or the key hash. The
 * `prefix` (first 12 chars) is included because it is already
 * public-facing (shown in dashboards, similar to Stripe).
 */
export class ApiKeyService {
  private readonly audit: AuditService | null;

  constructor(
    private prisma: PrismaClient,
    options: ApiKeyServiceOptions = {}
  ) {
    this.audit = options.audit === null ? null : (options.audit ?? new AuditService(prisma));
  }

  async create(
    tenantId: string,
    name: string,
    scopes: string[],
    createdBy?: string,
    expiresAt?: Date
  ): Promise<CreatedApiKey> {
    const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    const randomPart = crypto.randomBytes(24).toString('base64url');
    const plainKey = `nr_${env}_${randomPart}`;

    const keyHash = await bcrypt.hash(plainKey, 10);
    const prefix = plainKey.substring(0, 12);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name,
        keyHash,
        prefix,
        scopes,
        createdBy,
        expiresAt,
      },
    });

    await this.safeAudit('apikey.created', {
      tenantId,
      actorId: createdBy ?? null,
      resource: apiKey.id,
      payload: {
        keyId: apiKey.id,
        name,
        prefix,
        scopes,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
    });

    return { ...apiKey, plainKey };
  }

  /**
   * Verify a raw API key and return the context (tenantId, scopes).
   * Returns null if invalid, expired, or not found.
   */
  async validate(rawKey: string): Promise<ApiKeyContext | null> {
    if (!rawKey || !rawKey.startsWith('nr_')) return null;

    const prefix = rawKey.substring(0, 12);
    const candidates = await this.prisma.apiKey.findMany({
      where: {
        prefix,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
    });

    for (const candidate of candidates) {
      const matches = await bcrypt.compare(rawKey, candidate.keyHash);
      if (matches) {
        const wasFirstUse = candidate.lastUsedAt === null;

        // Update lastUsedAt fire-and-forget
        this.prisma.apiKey
          .update({
            where: { id: candidate.id },
            data: { lastUsedAt: new Date() },
          })
          .catch(() => {
            /* ignore */
          });

        if (wasFirstUse) {
          await this.safeAudit('apikey.used', {
            tenantId: candidate.tenantId,
            actorId: candidate.id,
            resource: candidate.id,
            payload: {
              keyId: candidate.id,
              name: candidate.name,
              prefix: candidate.prefix,
              firstUse: true,
            },
          });
        }

        return {
          keyId: candidate.id,
          tenantId: candidate.tenantId,
          scopes: candidate.scopes,
        };
      }
    }

    return null;
  }

  async list(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(tenantId: string, keyId: string): Promise<boolean> {
    // Capture the key info BEFORE the delete so we can audit it.
    const existing = await this.prisma.apiKey.findFirst({
      where: { id: keyId, tenantId },
      select: { id: true, name: true, prefix: true, scopes: true },
    });
    if (!existing) return false;

    const result = await this.prisma.apiKey.deleteMany({
      where: { id: keyId, tenantId },
    });
    if (result.count === 0) return false;

    await this.safeAudit('apikey.revoked', {
      tenantId,
      actorId: null,
      resource: keyId,
      payload: {
        keyId: existing.id,
        name: existing.name,
        prefix: existing.prefix,
        scopes: existing.scopes,
      },
    });

    return true;
  }

  private async safeAudit(
    type: 'apikey.created' | 'apikey.used' | 'apikey.revoked',
    params: {
      tenantId: string;
      actorId: string | null;
      resource: string;
      payload: Record<string, unknown>;
    }
  ): Promise<void> {
    if (!this.audit) return;
    try {
      await this.audit.record({
        tenantId: params.tenantId,
        type,
        actorId: params.actorId,
        actorType: type === 'apikey.used' ? 'apikey' : 'user',
        resource: params.resource,
        payload: params.payload,
      });
    } catch {
      // Audit failures must never break key issuance / validation.
    }
  }
}
