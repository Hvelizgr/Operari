import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export type SshPolicy = 'registered' | 'any';
export type SandboxEgress = 'open' | 'allowlist' | 'none';

export interface TenantPolicy {
  sshPolicy: SshPolicy;
  sandboxEgress: SandboxEgress;
  egressAllowlist: string[];
  privilegedApprovals: 1 | 2;
}

export const DEFAULT_POLICY: TenantPolicy = {
  sshPolicy: 'registered',
  sandboxEgress: 'open',
  egressAllowlist: [],
  privilegedApprovals: 1,
};

/** `example.com`, `*.example.com`; no schemes, paths, ports or IPs. */
export const egressHostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^(\*\.)?(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    'expected a hostname like pypi.org or *.github.com'
  );

export const policyUpdateSchema = z
  .object({
    sshPolicy: z.enum(['registered', 'any']),
    sandboxEgress: z.enum(['open', 'allowlist', 'none']),
    egressAllowlist: z.array(egressHostSchema).max(200),
    privilegedApprovals: z.union([z.literal(1), z.literal(2)]),
  })
  .partial();

export function normalizePolicy(
  row: Partial<Record<keyof TenantPolicy, unknown>> | null
): TenantPolicy {
  if (!row) return DEFAULT_POLICY;
  return {
    sshPolicy: row.sshPolicy === 'any' ? 'any' : 'registered',
    sandboxEgress:
      row.sandboxEgress === 'allowlist' || row.sandboxEgress === 'none'
        ? row.sandboxEgress
        : 'open',
    egressAllowlist: Array.isArray(row.egressAllowlist)
      ? (row.egressAllowlist as unknown[]).filter((h): h is string => typeof h === 'string')
      : [],
    privilegedApprovals: row.privilegedApprovals === 2 ? 2 : 1,
  };
}

const TTL_MS = 15_000;

/**
 * Cached reads of the execution policy. A change takes effect within
 * TTL_MS everywhere, and immediately in the process that wrote it
 * (`invalidate`).
 */
export class TenantPolicyStore {
  private readonly cache = new Map<string, { at: number; policy: TenantPolicy }>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => number = Date.now
  ) {}

  async get(tenantId: string): Promise<TenantPolicy> {
    const hit = this.cache.get(tenantId);
    if (hit && this.now() - hit.at < TTL_MS) return hit.policy;
    const row = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        sshPolicy: true,
        sandboxEgress: true,
        egressAllowlist: true,
        privilegedApprovals: true,
      },
    });
    const policy = normalizePolicy(row);
    this.cache.set(tenantId, { at: this.now(), policy });
    return policy;
  }

  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }
}

let shared: TenantPolicyStore | null = null;

export function tenantPolicyStore(prisma: PrismaClient): TenantPolicyStore {
  if (!shared) shared = new TenantPolicyStore(prisma);
  return shared;
}
