import type { PrismaClient, Prisma } from '@prisma/client';
import type { StoreSetNodeConfig, StoreResult, ExecutionInput } from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';
import { resolveTemplate } from './_shared';
import { NodeExecutionError, ErrorCode } from '../../errors/custom-error';

/**
 * StoreSet node — writes a key/value pair into a tenant-scoped
 * StorageBucket. The bucket is upserted, then a single key is added
 * to its JSON `data` field.
 *
 * Behavior preserved exactly from the legacy `executeStoreSet` method:
 *   - Throws CONFIGURATION_ERROR when key is missing
 *   - Defaults bucket to "default"
 *   - Upserts the bucket per (tenantId, name) — first call for a new
 *     bucket creates it with `data: {}`
 *   - Resolves {{templates}} in bucketName, key, and value
 *
 * Requires `tenantId` from the dispatcher; the dispatcher refuses to
 * invoke this executor without one.
 */
export class StoreSetNodeExecutor implements EditorNodeExecutor<StoreSetNodeConfig, StoreResult> {
  readonly type = 'StoreSet';

  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    config: StoreSetNodeConfig,
    input: ExecutionInput,
    errorContext: NodeErrorContext,
    tenantId?: string
  ): Promise<StoreResult> {
    if (!tenantId) {
      throw new NodeExecutionError({
        ...errorContext,
        message: 'Tenant ID is required for storage operations',
        code: ErrorCode.CONFIGURATION_ERROR,
      });
    }

    const { bucketName = 'default', key, value } = config;
    if (!key) {
      throw new NodeExecutionError({
        ...errorContext,
        message: 'Storage key is required for Set operation',
        code: ErrorCode.CONFIGURATION_ERROR,
      });
    }

    const resolvedBucketName = resolveTemplate(bucketName, input);
    const resolvedKey = resolveTemplate(key, input);
    const resolvedValue = resolveTemplate(value, input);

    const bucket = await this.prisma.storageBucket.upsert({
      where: { tenantId_name: { tenantId, name: resolvedBucketName } },
      create: {
        name: resolvedBucketName,
        tenantId,
        data: {} as Prisma.InputJsonValue,
      },
      update: {},
    });

    const currentData = (bucket.data as Record<string, unknown>) || {};
    const newData = { ...currentData, [resolvedKey]: resolvedValue };

    await this.prisma.storageBucket.update({
      where: { id: bucket.id },
      data: { data: newData as Prisma.InputJsonValue },
    });

    return { success: true, key: resolvedKey, value: resolvedValue };
  }
}
