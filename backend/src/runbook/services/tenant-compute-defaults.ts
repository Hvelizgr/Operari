import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

/**
 * Tenant-wide compute defaults — workspace-level fallbacks applied
 * by the trigger entry points when neither the request payload nor
 * the runbook spec supplies an explicit value.
 *
 * Stored as JSONB on Tenant.computeDefaults; this module is the
 * single read path so the parsing rules (allowed enum values,
 * positive ints, max bounds) are not duplicated across consumers.
 *
 * Resolution order at trigger time:
 *   1. Explicit value in the trigger request body
 *   2. Runbook-spec default (future — not yet wired)
 *   3. Tenant default (this module)
 *   4. Engine fallback (small-1x, no TTL, 0 retries, dry-run off)
 *
 * Sub-runs and other internal callers DO NOT pick up tenant
 * defaults — they're applied only at the user-facing entry layer.
 * That keeps "what the operator typed" the source of truth for the
 * full call tree below it.
 */

const computeDefaultsSchema = z.object({
  machine: z
    .enum(['micro', 'small-1x', 'small-2x', 'medium-1x', 'medium-2x', 'large-1x', 'large-2x'])
    .nullable()
    .optional(),
  ttlSeconds: z
    .number()
    .int()
    .positive()
    .max(7 * 24 * 3600)
    .nullable()
    .optional(),
  retryCount: z.number().int().min(0).max(10).nullable().optional(),
  dryRun: z.boolean().nullable().optional(),
});

export type TenantComputeDefaults = z.infer<typeof computeDefaultsSchema>;

/**
 * Read + parse the tenant's compute defaults. Returns an empty
 * object (not null) so callers can do `defaults.ttlSeconds ?? ...`
 * without a null check. Malformed payloads fall back to empty —
 * a corrupt JSONB row should not block triggers.
 */
export async function loadTenantComputeDefaults(
  prisma: PrismaClient,
  tenantId: string
): Promise<TenantComputeDefaults> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { computeDefaults: true },
    });
    if (!tenant?.computeDefaults) return {};
    const parsed = computeDefaultsSchema.safeParse(tenant.computeDefaults);
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}
